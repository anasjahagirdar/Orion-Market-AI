"""
ai_engine.py
Generates intelligent responses using Claude AI + RAG context.
"""

import logging
from django.conf import settings
from .rag_engine import search_vector_db, index_stock_data

logger = logging.getLogger(__name__)


def get_stock_context(query):
    """Get relevant stock context from vector DB"""
    try:
        # Search vector DB
        results = search_vector_db(query, n_results=5)

        if not results:
            # Index stocks if empty
            count = index_stock_data()
            if count > 0:
                results = search_vector_db(query, n_results=5)

        return results

    except Exception as e:
        logger.error(f"Context retrieval error: {e}")
        return []


def get_live_stock_data(symbol):
    """Get live stock price for context"""
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        fast = ticker.fast_info
        return {
            'price': round(fast.last_price, 2) if fast.last_price else None,
            'change': round(fast.last_price - fast.previous_close, 2)
                      if fast.last_price and fast.previous_close else None,
        }
    except Exception:
        return None


def extract_stock_symbols(message):
    """Extract stock symbols from user message"""
    from stocks.models import Stock

    message_upper = message.upper()
    found_stocks = []

    # Check against known symbols
    symbols = Stock.objects.filter(
        is_active=True
    ).values_list('symbol', 'name')

    for symbol, name in symbols:
        clean_symbol = symbol.replace('.NS', '').replace('.BSE', '')
        if clean_symbol in message_upper or name.upper() in message_upper:
            found_stocks.append({'symbol': symbol, 'name': name})

    return found_stocks[:3]


def generate_response_with_gemini(message, context_docs, stock_data=None):
    """Generate response using Google Gemini API"""
    try:
        import google.generativeai as genai

        api_key = settings.GEMINI_API_KEY
        if not api_key or api_key == 'your_gemini_api_key_here':
            return None

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')

        # Build context string
        context_str = ""
        if context_docs:
            context_str = "\n\nRelevant market data:\n"
            for doc in context_docs[:3]:
                context_str += f"- {doc['text']}\n"

        if stock_data:
            context_str += "\n\nLive price data:\n"
            for symbol, data in stock_data.items():
                if data:
                    context_str += f"- {symbol}: ${data['price']} "
                    if data['change']:
                        direction = "▲" if data['change'] > 0 else "▼"
                        context_str += f"({direction}{abs(data['change'])})\n"

        prompt = f"""You are Orion, an expert AI stock market analyst assistant.
You provide clear, concise insights about stocks, market trends, and investment analysis.
You have access to real-time market data and news sentiment.
Always be factual, mention this is not financial advice, keep responses under 150 words.

User question: {message}
{context_str}

Provide a helpful, concise market analysis response."""

        response = model.generate_content(prompt)
        return response.text

    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        return None


def generate_smart_response(message):
    """
    Main function: generates intelligent stock market response.
    1. Extract stock symbols from message
    2. Get RAG context
    3. Get live prices
    4. Generate response with Claude
    5. Fallback to rule-based if Claude unavailable
    """
    try:
        # Step 1: Find mentioned stocks
        mentioned_stocks = extract_stock_symbols(message)

        # Step 2: Get RAG context
        context_docs = get_stock_context(message)

        # Step 3: Get live prices for mentioned stocks
        stock_data = {}
        for stock in mentioned_stocks[:2]:
            data = get_live_stock_data(stock['symbol'])
            if data:
                stock_data[stock['symbol']] = data

        # Step 4: Try Claude
        # Step 4: Try Gemini
        gemini_response = generate_response_with_gemini(
            message, context_docs, stock_data
        )

        if gemini_response:
            return gemini_response

        # Step 5: Smart fallback without Claude
        return generate_fallback_response(message, mentioned_stocks, stock_data)

    except Exception as e:
        logger.error(f"generate_smart_response error: {e}")
        return "I encountered an error. Please try again."


def generate_fallback_response(message, stocks, stock_data):
    """Smart rule-based fallback when Claude is unavailable"""
    msg = message.lower()

    if stocks and stock_data:
        symbol = stocks[0]['symbol']
        name = stocks[0]['name']
        data = stock_data.get(symbol, {})

        if data and data.get('price'):
            direction = "up" if data.get('change', 0) > 0 else "down"
            change = abs(data.get('change', 0))
            return (
                f"{name} ({symbol}) is currently trading at "
                f"${data['price']:.2f}, {direction} ${change:.2f} today. "
                f"Ask me anything about this stock's performance or outlook!"
            )

    if any(w in msg for w in ['sentiment', 'bullish', 'bearish', 'feeling']):
        if stocks:
            return (
                f"Sentiment analysis for {stocks[0]['name']} requires "
                f"news data processing. Add NEWS_API_KEY for live sentiment. "
                f"Ask me anything about this stock's performance or outlook!"
            )
        return "I can analyze sentiment for any stock. Which stock are you interested in?"

    if any(w in msg for w in ['buy', 'sell', 'invest', 'good']):
        if stocks:
            return (
                f"For {stocks[0]['name']}, I recommend checking recent earnings, "
                f"sector performance, and news sentiment before making decisions. "
                f"This is not financial advice."
            )
        return "I can help analyze stocks for investment research. Which stock interests you?"

    if any(w in msg for w in ['news', 'latest', 'recent']):
        if stocks:
            return f"Fetching latest news for {stocks[0]['name']}. Add NEWS_API_KEY for live news."
        return "I can fetch latest market news. Which stock or sector interests you?"

    if any(w in msg for w in ['sector', 'industry', 'best']):
        return (
            "Based on our 400-stock database, Technology and Banking are "
            "the largest sectors in both India and US markets. "
            "Try asking about a specific sector like 'Tell me about Technology stocks'."
        )

    if any(w in msg for w in ['hello', 'hi', 'hey']):
        return (
            "Hello! I'm Orion, your AI market assistant. I track 400+ stocks "
            "across India and US markets. Ask me about any stock, sector, or market trend!"
        )

    return (
        "I can help with stock analysis, sentiment, news, and market trends. "
        "Try asking: 'What is the sentiment for AAPL?' or 'Tell me about TCS stock.'"
    )