import requests
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)

# Strictly financial/stock market search terms
STOCK_MARKET_QUERY = (
    '(stock market OR earnings report OR NYSE OR NASDAQ OR '
    'S&P500 OR "Dow Jones" OR "stock price" OR IPO OR "Fed rate" OR '
    '"quarterly results" OR "market rally" OR "bull market" OR "bear market" OR '
    '"hedge fund" OR "stock exchange" OR "market cap" OR "share price") '
    'AND NOT (recipe OR food OR sports OR movie OR music OR fashion)'
)


def fetch_news_from_api(query, page_size=20):
    """Fetch news from NewsAPI with fallback"""
    api_key = settings.NEWS_API_KEY

    if not api_key or api_key == 'your_newsapi_key_here':
        return None, 'NEWS_API_KEY not configured'

    try:
        url = (
            f"https://newsapi.org/v2/everything"
            f"?q={query}"
            f"&language=en"
            f"&sortBy=publishedAt"
            f"&pageSize={page_size}"
            f"&apiKey={api_key}"
        )
        response = requests.get(url, timeout=10)
        data = response.json()

        if data.get('status') != 'ok':
            return None, data.get('message', 'NewsAPI error')

        return data.get('articles', []), None

    except requests.Timeout:
        return None, 'Request timed out'
    except Exception as e:
        logger.error(f"News fetch error: {e}")
        return None, str(e)


def format_articles(articles):
    """Clean and format articles"""
    formatted = []
    for article in articles:
        title = article.get('title', '')
        # Skip removed or empty articles
        if not title or title == '[Removed]':
            continue
        formatted.append({
            'title': title,
            'description': article.get('description', ''),
            'url': article.get('url', ''),
            'source': article.get('source', {}).get('name', 'Unknown'),
            'published_at': article.get('publishedAt', ''),
            'image': article.get('urlToImage', ''),
        })
    return formatted


@api_view(['GET'])
@permission_classes([AllowAny])
def get_news(request):
    """Get latest stock market news only"""
    try:
        # Always use stock market focused query
        articles, error = fetch_news_from_api(STOCK_MARKET_QUERY, page_size=20)

        if error:
            # Return helpful mock data if API key not set
            return Response({
                'articles': [
                    {
                        'title': 'Add your NEWS_API_KEY in .env to see live market news',
                        'description': 'Get a free key at newsapi.org/register',
                        'url': 'https://newsapi.org/register',
                        'source': 'Orion Market AI',
                        'published_at': '',
                        'image': '',
                    }
                ],
                'total': 0,
                'error': error
            })

        formatted = format_articles(articles)
        return Response({
            'articles': formatted,
            'total': len(formatted)
        })

    except Exception as e:
        logger.error(f"get_news error: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def get_stock_news(request, symbol):
    """Get news specifically for a stock symbol"""
    try:
        # Clean symbol for search (remove .NS suffix for Indian stocks)
        clean_symbol = symbol.replace('.NS', '').replace('.BSE', '')

        query = (
            f'"{clean_symbol}" stock OR '
            f'"{clean_symbol}" shares OR '
            f'"{clean_symbol}" earnings OR '
            f'"{clean_symbol}" market'
        )

        articles, error = fetch_news_from_api(query, page_size=10)

        if error:
            return Response({
                'symbol': symbol.upper(),
                'articles': [],
                'total': 0,
                'error': error
            })

        formatted = format_articles(articles)
        return Response({
            'symbol': symbol.upper(),
            'articles': formatted,
            'total': len(formatted)
        })

    except Exception as e:
        logger.error(f"get_stock_news error: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )