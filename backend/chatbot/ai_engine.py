"""
ai_engine.py
Generates intelligent responses using Groq (LLaMA 3) + RAG context.
"""

import os
import logging
from django.conf import settings
from .rag_engine import search_vector_db, index_stock_data

logger = logging.getLogger(__name__)


# ─── Groq Client (lazy init) ──────────────────────────────────────────────────
_groq_client = None

def get_groq_client():
    """Get or create Groq client"""
    global _groq_client
    if _groq_client is not None:
        return _groq_client
    try:
        from groq import Groq
        api_key = os.environ.get('GROQ_API_KEY') or settings.GROQ_API_KEY
        if not api_key or 'your_groq' in str(api_key):
            logger.warning("GROQ_API_KEY not configured")
            return None
        _groq_client = Groq(api_key=api_key)
        logger.info("Groq client initialized successfully")
        return _groq_client
    except Exception as e:
        logger.error(f"Groq client init error: {e}")
        return None


# ─── Stock Context ────────────────────────────────────────────────────────────
def get_stock_context(query):
    """Get relevant stock context from ChromaDB vector DB"""
    try:
        results = search_vector_db(query, n_results=5)
        if not results:
            count = index_stock_data()
            if count > 0:
                results = search_vector_db(query, n_results=5)
        return results
    except Exception as e:
        logger.error(f"Context retrieval error: {e}")
        return []


def get_live_stock_data(symbol):
    """Get live stock price for context injection"""
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        fast = ticker.fast_info
        price = fast.last_price
        prev = fast.previous_close
        return {
            'price': round(price, 2) if price else None,
            'change': round(price - prev, 2) if price and prev else None,
        }
    except Exception:
        return None


def extract_stock_symbols(message):
    """Extract stock symbols mentioned in the user message"""
    try:
        from stocks.models import Stock
        message_upper = message.upper()
        found = []

        symbols = Stock.objects.filter(
            is_active=True
        ).values_list('symbol', 'name')[:400]

        for symbol, name in symbols:
            clean = symbol.replace('.NS', '').replace('.BSE', '')
            if clean in message_upper or name.upper() in message_upper:
                found.append({'symbol': symbol, 'name': name})
            if len(found) >= 3:
                break

        return found
    except Exception as e:
        logger.error(f"Symbol extraction error: {e}")
        return []


# ─── Groq Response Generation ─────────────────────────────────────────────────
def generate_response_with_groq(message, context_docs, stock_data=None):
    """Generate AI response using Groq LLaMA 3"""
    try:
        client = get_groq_client()
        if not client:
            return None

        # Build context string
        context_str = ""
        if context_docs:
            context_str += "\n\nRelevant market data:\n"
            for doc in context_docs[:3]:
                context_str += f"- {doc['text']}\n"

        if stock_data:
            context_str += "\n\nLive price data:\n"
            for symbol, data in stock_data.items():
                if data and data.get('price'):
                    direction = "▲" if (data.get('change') or 0) > 0 else "▼"
                    change = abs(data.get('change') or 0)
                    context_str += f"- {symbol}: ${data['price']:.2f} ({direction}${change:.2f})\n"

        system_prompt = """You are Orion, an expert AI stock market analyst assistant.
You provide clear, concise insights about stocks, market trends, and investment analysis.
You have access to real-time market data and news sentiment analysis.
Always be factual, mention that this is not financial advice, and keep responses under 150 words.
Be direct and helpful. Format key numbers clearly."""

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"{message}{context_str}"}
            ],
            max_tokens=300,
            temperature=0.7,
        )

        return response.choices[0].message.content

    except Exception as e:
        logger.error(f"Groq API error: {type(e).__name__}: {e}")
        return None


# ─── Fallback Response ────────────────────────────────────────────────────────
def generate_fallback_response(message, stocks, stock_data):
    """Rule-based fallback when Groq is unavailable"""
    msg = message.lower()

    if stocks and stock_data:
        symbol = stocks[0]['symbol']
        name = stocks[0]['name']
        data = stock_data.get(symbol, {})
        if data and data.get('price'):
            direction = "up" if (data.get('change') or 0) > 0 else "down"
            change = abs(data.get('change') or 0)
            return (
                f"{name} ({symbol}) is currently trading at "
                f"${data['price']:.2f}, {direction} ${change:.2f} today. "
                f"Ask me anything about this stock's performance or outlook!"
            )

    if any(w in msg for w in ['sentiment', 'bullish', 'bearish']):
        if stocks:
            return f"I can analyze sentiment for {stocks[0]['name']}. Ask me about its recent performance or market outlook!"
        return "I can analyze sentiment for any of our 400+ tracked stocks. Which stock interests you?"

    if any(w in msg for w in ['buy', 'sell', 'invest']):
        if stocks:
            return (
                f"For {stocks[0]['name']}, consider checking recent earnings, "
                f"sector performance, and market sentiment. This is not financial advice."
            )
        return "I can help analyze stocks for investment research. Which stock interests you?"

    if any(w in msg for w in ['sector', 'industry', 'best']):
        return (
            "Based on our 400-stock database, Technology and Banking are "
            "the largest sectors in both India and US markets. "
            "Ask about a specific sector like 'Tell me about Technology stocks'."
        )

    if any(w in msg for w in ['news', 'latest', 'recent']):
        if stocks:
            return f"Here's what I know about {stocks[0]['name']}. Ask me about its price, sector, or market performance!"
        return "I can provide latest market insights. Which stock or sector interests you?"

    if any(w in msg for w in ['hello', 'hi', 'hey']):
        return (
            "Hello! I'm Orion, your AI market assistant. I track 400+ stocks "
            "across India and US markets. Ask me about any stock, sector, or market trend!"
        )

    return (
        "I can help with stock analysis, sentiment, news, and market trends across "
        "400+ stocks. Try: 'What is the price of AAPL?' or 'Tell me about TCS stock.'"
    )


# ─── Main Entry Point ─────────────────────────────────────────────────────────
def generate_smart_response(message):
    """
    Main function — generates intelligent stock market response.
    1. Detect general vs specific stock question
    2. Extract stock symbols
    3. Get RAG context from ChromaDB
    4. Get live prices
    5. Generate Groq response
    6. Fallback if Groq unavailable
    """
    try:
        msg_lower = message.lower()

        # Detect general market questions — skip stock extraction
        general_keywords = [
            'sector', 'industry', 'best sector', 'top sector',
            'market trend', 'overall market', 'which sector',
            'india market', 'us market', 'nifty', 'sensex', 'dow jones'
        ]
        is_general = any(kw in msg_lower for kw in general_keywords)

        # Step 1: Extract stock symbols (skip for general questions)
        mentioned_stocks = [] if is_general else extract_stock_symbols(message)

        # Step 2: Get RAG context
        context_docs = get_stock_context(message)

        # Step 3: Get live prices for mentioned stocks
        stock_data = {}
        for stock in mentioned_stocks[:2]:
            data = get_live_stock_data(stock['symbol'])
            if data:
                stock_data[stock['symbol']] = data

        # Step 4: Try Groq
        groq_response = generate_response_with_groq(
            message, context_docs, stock_data
        )

        if groq_response:
            return groq_response

        # Step 5: Fallback
        return generate_fallback_response(message, mentioned_stocks, stock_data)

    except Exception as e:
        logger.error(f"generate_smart_response error: {e}")
        return "I encountered an error. Please try again."