from datetime import datetime, timedelta, timezone

import requests
from django.conf import settings
from django.core.cache import cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)

ALPHA_BASE_URL = 'https://www.alphavantage.co/query'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'
MARKET_NEWS_CACHE_TTL_SECONDS = 120
STOCK_NEWS_CACHE_TTL_SECONDS = 90

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


def _safe_float(value, default=None):
    try:
        if value is None or value == '':
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _normalize_symbol(symbol):
    return symbol.upper().replace('.NS', '').replace('.BSE', '')


def _published_from_alpha(value):
    if not value:
        return ''
    try:
        parsed = datetime.strptime(value, '%Y%m%dT%H%M%S')
        return parsed.replace(tzinfo=timezone.utc).isoformat()
    except ValueError:
        return ''


def _published_from_finnhub(value):
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc).isoformat()
    except (TypeError, ValueError):
        return ''


def _sentiment_label_from_score(score):
    if score is None:
        return 'neutral'
    if score >= 0.15:
        return 'bullish'
    if score <= -0.15:
        return 'bearish'
    return 'neutral'


def _label_to_score(label):
    normalized = str(label or '').strip().lower()
    if 'bull' in normalized:
        return 0.65
    if 'bear' in normalized:
        return -0.65
    if 'neutral' in normalized:
        return 0.0
    return None


def normalize_sentiment_label(label):
    normalized = str(label or '').strip().lower()
    if 'bull' in normalized:
        return 'bullish'
    if 'bear' in normalized:
        return 'bearish'
    return 'neutral'


def _clip_score(score, default=None):
    value = _safe_float(score, default)
    if value is None:
        return None
    if value > 1:
        if value <= 100:
            value = value / 100
        else:
            value = 1.0
    if value < -1:
        value = -1.0
    return round(value, 4)


def _infer_sentiment_from_text(article):
    text = f"{article.get('title', '')} {article.get('description', '')}".lower()
    if not text.strip():
        return None

    positive_keywords = (
        'beat',
        'beats',
        'surge',
        'rally',
        'gain',
        'gains',
        'strong',
        'growth',
        'upgrade',
        'bullish',
        'outperform',
        'profit',
        'profits',
        'record high',
    )
    negative_keywords = (
        'miss',
        'misses',
        'drop',
        'drops',
        'fall',
        'falls',
        'weak',
        'downgrade',
        'bearish',
        'underperform',
        'loss',
        'losses',
        'lawsuit',
        'investigation',
        'decline',
    )

    positive_hits = sum(1 for token in positive_keywords if token in text)
    negative_hits = sum(1 for token in negative_keywords if token in text)
    total_hits = positive_hits + negative_hits
    if total_hits == 0:
        return None

    raw = (positive_hits - negative_hits) / total_hits
    return _clip_score(raw, default=None)


def _is_rate_limit_warning(message):
    msg = str(message or '').lower()
    return 'rate limit' in msg or 'too many requests' in msg or 'http 429' in msg


def _fetch_alpha_sentiment(symbol, limit=10):
    api_key = settings.ALPHA_VANTAGE_API_KEY
    if not api_key or api_key == 'your_alpha_vantage_key_here':
        return [], 'ALPHA_VANTAGE_API_KEY not configured'

    clean_symbol = _normalize_symbol(symbol)

    try:
        response = requests.get(
            ALPHA_BASE_URL,
            params={
                'function': 'NEWS_SENTIMENT',
                'tickers': clean_symbol,
                'sort': 'LATEST',
                'limit': limit,
                'apikey': api_key,
            },
            timeout=12,
        )
        payload = response.json()

        note = str(payload.get('Note', '')).lower() if isinstance(payload, dict) else ''
        info = str(payload.get('Information', '')).lower() if isinstance(payload, dict) else ''
        if 'rate limit' in note or 'rate limit' in info:
            return [], 'Alpha Vantage rate limit reached'

        feed = payload.get('feed', []) if isinstance(payload, dict) else []
        results = []
        for item in feed:
            ticker_specific_score = None
            ticker_specific_label = None
            for ticker_sentiment in item.get('ticker_sentiment', []):
                current_ticker = str(ticker_sentiment.get('ticker', '')).upper()
                if current_ticker == clean_symbol:
                    ticker_specific_score = _safe_float(ticker_sentiment.get('ticker_sentiment_score'))
                    ticker_specific_label = ticker_sentiment.get('ticker_sentiment_label')
                    break

            alpha_score = ticker_specific_score
            if alpha_score is None:
                alpha_score = _safe_float(item.get('overall_sentiment_score'))
            if alpha_score is None:
                alpha_score = _label_to_score(
                    ticker_specific_label or item.get('overall_sentiment_label')
                )

            alpha_score = _clip_score(alpha_score, default=None)

            results.append(
                {
                    'title': item.get('title', ''),
                    'description': item.get('summary', ''),
                    'url': item.get('url', ''),
                    'source': item.get('source', '') or item.get('source_domain', 'Alpha Vantage'),
                    'published_at': _published_from_alpha(item.get('time_published')),
                    'image': item.get('banner_image', ''),
                    'alpha_score': alpha_score,
                    'alpha_label': _sentiment_label_from_score(alpha_score),
                }
            )

        return results, None
    except requests.Timeout:
        return [], 'Alpha Vantage sentiment request timed out'
    except Exception as exc:
        logger.error('Alpha sentiment fetch error for %s: %s', symbol, exc)
        return [], str(exc)


def _fetch_finnhub_company_news(symbol, limit=10):
    api_key = settings.FINNHUB_API_KEY
    if not api_key or api_key == 'your_finnhub_key_here':
        return [], 'FINNHUB_API_KEY not configured'

    clean_symbol = _normalize_symbol(symbol)
    end_date = datetime.now(timezone.utc).date()
    start_date = end_date - timedelta(days=30)

    try:
        response = requests.get(
            f'{FINNHUB_BASE_URL}/company-news',
            params={
                'symbol': clean_symbol,
                'from': start_date.isoformat(),
                'to': end_date.isoformat(),
                'token': api_key,
            },
            timeout=12,
        )
        payload = response.json()

        if isinstance(payload, dict) and payload.get('error'):
            return [], f'Finnhub news error: {payload.get("error")}'

        if not isinstance(payload, list):
            return [], 'Finnhub company news unavailable'

        results = []
        for item in payload[:limit]:
            results.append(
                {
                    'title': item.get('headline', ''),
                    'description': item.get('summary', ''),
                    'url': item.get('url', ''),
                    'source': item.get('source', 'Finnhub'),
                    'published_at': _published_from_finnhub(item.get('datetime')),
                    'image': item.get('image', ''),
                }
            )
        return results, None
    except requests.Timeout:
        return [], 'Finnhub news request timed out'
    except Exception as exc:
        logger.error('Finnhub company news fetch error for %s: %s', symbol, exc)
        return [], str(exc)


def _fetch_finnhub_news_sentiment_score(symbol):
    api_key = settings.FINNHUB_API_KEY
    if not api_key or api_key == 'your_finnhub_key_here':
        return None, 'FINNHUB_API_KEY not configured'

    clean_symbol = _normalize_symbol(symbol)

    try:
        response = requests.get(
            f'{FINNHUB_BASE_URL}/news-sentiment',
            params={'symbol': clean_symbol, 'token': api_key},
            timeout=12,
        )
        payload = response.json()

        if isinstance(payload, dict) and payload.get('error'):
            return None, f'Finnhub sentiment error: {payload.get("error")}'

        sentiment = payload.get('sentiment', {}) if isinstance(payload, dict) else {}
        company_news_score = _safe_float(sentiment.get('companyNewsScore'))
        if company_news_score is None and isinstance(payload, dict):
            company_news_score = _safe_float(payload.get('companyNewsScore'))
        if company_news_score is None:
            bullish = _safe_float(sentiment.get('bullishPercent'))
            bearish = _safe_float(sentiment.get('bearishPercent'))
            if bullish is not None and bearish is not None:
                company_news_score = (bullish - bearish) / 100
        if company_news_score is None:
            return None, 'Finnhub sentiment score unavailable'

        return _clip_score(company_news_score, default=None), None
    except requests.Timeout:
        return None, 'Finnhub sentiment request timed out'
    except Exception as exc:
        logger.error('Finnhub sentiment fetch error for %s: %s', symbol, exc)
        return None, str(exc)


def _merge_stock_news_with_sentiment(symbol):
    alpha_articles, alpha_error = _fetch_alpha_sentiment(symbol, limit=12)
    finnhub_articles, finnhub_news_error = _fetch_finnhub_company_news(symbol, limit=12)
    finnhub_score, finnhub_sentiment_error = _fetch_finnhub_news_sentiment_score(symbol)

    warnings = []
    for item in [alpha_error, finnhub_news_error, finnhub_sentiment_error]:
        if item:
            warnings.append(item)

    merged = {}

    def upsert_article(article):
        title = article.get('title', '')
        if not title or title == '[Removed]':
            return

        key = title.strip().lower()
        if key not in merged:
            merged[key] = {
                'title': title,
                'description': article.get('description', ''),
                'url': article.get('url', ''),
                'source': article.get('source', 'Unknown'),
                'published_at': article.get('published_at', ''),
                'image': article.get('image', ''),
                'alpha_score': None,
                'alpha_label': None,
                'finnhub_score': None,
            }

        entry = merged[key]
        if article.get('url') and not entry.get('url'):
            entry['url'] = article.get('url')
        if article.get('published_at') and not entry.get('published_at'):
            entry['published_at'] = article.get('published_at')
        if article.get('source') and not entry.get('source'):
            entry['source'] = article.get('source')
        if article.get('description') and not entry.get('description'):
            entry['description'] = article.get('description')
        if article.get('image') and not entry.get('image'):
            entry['image'] = article.get('image')

        if article.get('alpha_score') is not None:
            entry['alpha_score'] = article.get('alpha_score')
            entry['alpha_label'] = article.get('alpha_label')

    for article in alpha_articles:
        upsert_article(article)

    for article in finnhub_articles:
        upsert_article(article)
        key = article.get('title', '').strip().lower()
        if key in merged and finnhub_score is not None:
            merged[key]['finnhub_score'] = finnhub_score

    if not merged:
        clean_symbol = _normalize_symbol(symbol)
        query = (
            f'"{clean_symbol}" stock OR '
            f'"{clean_symbol}" shares OR '
            f'"{clean_symbol}" earnings OR '
            f'"{clean_symbol}" market'
        )
        articles, fallback_error = fetch_news_from_api(query, page_size=10)
        if fallback_error:
            warnings.append(fallback_error)
            return [], warnings
        for article in format_articles(articles):
            upsert_article(article)

    final_articles = []
    for article in merged.values():
        score_candidates = []
        if article.get('alpha_score') is not None:
            score_candidates.append(article.get('alpha_score'))
        if article.get('finnhub_score') is not None:
            score_candidates.append(article.get('finnhub_score'))
        elif finnhub_score is not None and not score_candidates:
            # Use Finnhub company-level sentiment when per-article alignment is unavailable.
            score_candidates.append(finnhub_score)

        sentiment_score = round(sum(score_candidates) / len(score_candidates), 4) if score_candidates else None
        if sentiment_score is None:
            sentiment_score = _clip_score(_label_to_score(article.get('alpha_label')), default=None)
        if sentiment_score is None:
            sentiment_score = _infer_sentiment_from_text(article)
        if sentiment_score is None:
            sentiment_score = 0.0

        sentiment_label = (
            _sentiment_label_from_score(sentiment_score)
            if sentiment_score is not None
            else normalize_sentiment_label(article.get('alpha_label'))
        )

        sources = []
        if article.get('alpha_score') is not None:
            sources.append('alpha_vantage')
        if article.get('finnhub_score') is not None:
            sources.append('finnhub')

        final_articles.append(
            {
                'title': article.get('title', ''),
                'description': article.get('description', ''),
                'url': article.get('url', ''),
                'source': article.get('source', 'Unknown'),
                'published_at': article.get('published_at', ''),
                'image': article.get('image', ''),
                'sentiment_score': sentiment_score,
                'sentiment_label': sentiment_label,
                'sentiment_sources': sources or ['fallback'],
            }
        )

    final_articles.sort(key=lambda item: item.get('published_at') or '', reverse=True)
    return final_articles[:12], warnings


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
        cache_key = 'news:market:latest'
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        # Always use stock market focused query
        articles, error = fetch_news_from_api(STOCK_MARKET_QUERY, page_size=20)

        if error:
            # Return helpful mock data if API key not set
            payload = {
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
            }
            cache.set(cache_key, payload, 60)
            return Response(payload)

        formatted = format_articles(articles)
        payload = {
            'articles': formatted,
            'total': len(formatted)
        }
        cache.set(cache_key, payload, MARKET_NEWS_CACHE_TTL_SECONDS)
        return Response(payload)

    except Exception as e:
        logger.error(f"get_news error: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def get_stock_news(request, symbol):
    """Get stock news enriched with dual-source sentiment."""
    try:
        cache_key = f'news:stock:{symbol.upper()}'
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        formatted, warnings = _merge_stock_news_with_sentiment(symbol.upper())
        payload = {
            'symbol': symbol.upper(),
            'articles': formatted,
            'total': len(formatted),
            'sentiment_providers': ['alpha_vantage', 'finnhub'],
            'warnings': warnings[:3],
        }

        if not formatted and warnings and all(_is_rate_limit_warning(item) for item in warnings):
            payload['code'] = 'rate_limited'
            payload['retry_after_seconds'] = 60
            cache.set(cache_key, payload, 30)
            return Response(payload, status=status.HTTP_429_TOO_MANY_REQUESTS)

        cache.set(cache_key, payload, STOCK_NEWS_CACHE_TTL_SECONDS)
        return Response(payload)

    except Exception as e:
        logger.error(f"get_stock_news error: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
