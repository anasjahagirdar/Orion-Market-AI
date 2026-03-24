"""
rag_engine.py
Retrieval Augmented Generation engine for Orion Market AI chatbot.
Uses ChromaDB for vector storage and Claude for response generation.
"""

import os
import logging
import chromadb
from chromadb.utils import embedding_functions
from django.conf import settings

logger = logging.getLogger(__name__)

# ─── ChromaDB Setup ───────────────────────────────────────────────────────────
_chroma_client = None
_collection = None


def get_chroma_collection():
    """Get or create ChromaDB collection"""
    global _chroma_client, _collection

    if _collection is not None:
        return _collection

    try:
        _chroma_client = chromadb.PersistentClient(
            path="./chroma_db"
        )

        embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )

        _collection = _chroma_client.get_or_create_collection(
            name="orion_market_data",
            embedding_function=embedding_fn,
            metadata={"hnsw:space": "cosine"}
        )

        logger.info("ChromaDB collection ready")
        return _collection

    except Exception as e:
        logger.error(f"ChromaDB setup error: {e}")
        return None


def add_to_vector_db(documents, metadatas, ids):
    """Add documents to vector DB"""
    try:
        collection = get_chroma_collection()
        if not collection:
            return False

        collection.upsert(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        return True

    except Exception as e:
        logger.error(f"Vector DB add error: {e}")
        return False


def search_vector_db(query, n_results=5):
    """Search vector DB for relevant context"""
    try:
        collection = get_chroma_collection()
        if not collection:
            return []

        results = collection.query(
            query_texts=[query],
            n_results=min(n_results, collection.count() or 1)
        )

        if not results['documents'][0]:
            return []

        contexts = []
        for i, doc in enumerate(results['documents'][0]):
            metadata = results['metadatas'][0][i] if results['metadatas'] else {}
            contexts.append({
                'text': doc,
                'metadata': metadata,
                'distance': results['distances'][0][i] if results['distances'] else 0
            })

        return contexts

    except Exception as e:
        logger.error(f"Vector DB search error: {e}")
        return []


def index_stock_data():
    """Index all stocks and their data into vector DB"""
    try:
        from stocks.models import Stock
        from sentiment.models import SentimentResult, StockSentimentSummary

        stocks = Stock.objects.filter(is_active=True)[:100]
        documents = []
        metadatas = []
        ids = []

        for stock in stocks:
            # Basic stock info
            doc = f"{stock.name} ({stock.symbol}) is a {stock.market} stock in the {stock.sector} sector."

            # Add sentiment if available
            try:
                latest_sentiment = SentimentResult.objects.filter(
                    stock=stock
                ).order_by('-analyzed_at').first()

                if latest_sentiment:
                    doc += f" Latest sentiment: {latest_sentiment.sentiment_label} (score: {latest_sentiment.sentiment_score:.2f})."
            except Exception:
                pass

            documents.append(doc)
            metadatas.append({
                'symbol': stock.symbol,
                'name': stock.name,
                'market': stock.market,
                'sector': stock.sector or 'Unknown',
                'type': 'stock'
            })
            ids.append(f"stock_{stock.symbol}")

        if documents:
            add_to_vector_db(documents, metadatas, ids)
            logger.info(f"Indexed {len(documents)} stocks into vector DB")

        return len(documents)

    except Exception as e:
        logger.error(f"Stock indexing error: {e}")
        return 0


def index_news_data(articles):
    """Index news articles into vector DB"""
    try:
        documents = []
        metadatas = []
        ids = []

        for i, article in enumerate(articles):
            if not article.get('title'):
                continue

            doc = f"{article['title']}. {article.get('description', '')}"
            documents.append(doc[:1000])
            metadatas.append({
                'source': article.get('source', 'Unknown'),
                'url': article.get('url', ''),
                'published_at': article.get('published_at', ''),
                'type': 'news'
            })
            ids.append(f"news_{i}_{hash(article['title']) % 100000}")

        if documents:
            add_to_vector_db(documents, metadatas, ids)
            logger.info(f"Indexed {len(documents)} news articles")

        return len(documents)

    except Exception as e:
        logger.error(f"News indexing error: {e}")
        return 0