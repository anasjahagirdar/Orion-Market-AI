import logging
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
import yfinance as yf
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'
ALPHA_BASE_URL = 'https://www.alphavantage.co/query'

PRICE_CACHE_TTL_SECONDS = 30
HISTORY_CACHE_TTL_SECONDS = 300

PERIOD_TO_DAYS = {
    '1d': 1,
    '5d': 5,
    '1mo': 30,
    '3mo': 90,
    '6mo': 180,
    '1y': 365,
    '2y': 730,
    '5y': 1825,
    'max': 3650,
}

PERIOD_TO_TRADING_POINTS = {
    '1mo': 22,
    '3mo': 66,
    '6mo': 132,
    '1y': 252,
}


class ProviderError(Exception):
    def __init__(self, message, rate_limited=False):
        super().__init__(message)
        self.rate_limited = rate_limited


def _safe_float(value):
    try:
        if value is None or value == '':
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_int(value):
    try:
        if value is None or value == '':
            return None
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _configure_yfinance_cache():
    """
    Use a workspace-local writable path for yfinance metadata caches.
    This avoids sqlite permission issues in restricted environments.
    """
    cache_dir = Path(__file__).resolve().parent / '.yfinance_cache'
    cache_dir.mkdir(parents=True, exist_ok=True)
    if hasattr(yf, 'set_tz_cache_location'):
        yf.set_tz_cache_location(str(cache_dir))


def _period_days(period):
    return PERIOD_TO_DAYS.get(period, 30)


def _finnhub_resolution(interval):
    mapping = {
        '1d': 'D',
        '1wk': 'W',
        '1mo': 'M',
        '1m': '1',
        '5m': '5',
        '15m': '15',
        '30m': '30',
        '60m': '60',
    }
    return mapping.get(interval, 'D')


def _alpha_rate_limit_payload(data):
    if not isinstance(data, dict):
        return False
    note = str(data.get('Note', '')).lower()
    info = str(data.get('Information', '')).lower()
    return 'alpha vantage' in note or 'rate limit' in note or 'rate limit' in info


def _request_json(url, params, provider_name, timeout=10):
    try:
        response = requests.get(url, params=params, timeout=timeout)
        if response.status_code == 429:
            raise ProviderError(f'{provider_name} rate limit exceeded', rate_limited=True)
        if response.status_code >= 400:
            raise ProviderError(f'{provider_name} HTTP {response.status_code}')
        data = response.json()
    except requests.Timeout:
        raise ProviderError(f'{provider_name} request timed out')
    except requests.RequestException as exc:
        raise ProviderError(f'{provider_name} request failed: {exc}')
    except ValueError:
        raise ProviderError(f'{provider_name} returned non-JSON response')

    if provider_name == 'alpha_vantage' and _alpha_rate_limit_payload(data):
        raise ProviderError('Alpha Vantage rate limit exceeded', rate_limited=True)

    if provider_name == 'finnhub':
        error_value = str(data.get('error', '')).lower() if isinstance(data, dict) else ''
        if 'limit' in error_value:
            raise ProviderError('Finnhub rate limit exceeded', rate_limited=True)
        if error_value:
            raise ProviderError(f'Finnhub error: {data.get("error")}')

    return data


def _finnhub_price(symbol):
    token = settings.FINNHUB_API_KEY
    if not token:
        raise ProviderError('Finnhub API key missing')

    quote = _request_json(
        f'{FINNHUB_BASE_URL}/quote',
        {'symbol': symbol, 'token': token},
        'finnhub',
    )

    current = _safe_float(quote.get('c'))
    previous_close = _safe_float(quote.get('pc'))
    if current is None and previous_close is None:
        raise ProviderError(f'Finnhub has no quote data for {symbol}')

    profile = _request_json(
        f'{FINNHUB_BASE_URL}/stock/profile2',
        {'symbol': symbol, 'token': token},
        'finnhub',
    )

    metric_payload = _request_json(
        f'{FINNHUB_BASE_URL}/stock/metric',
        {'symbol': symbol, 'metric': 'all', 'token': token},
        'finnhub',
    )
    metrics = metric_payload.get('metric', {}) if isinstance(metric_payload, dict) else {}

    end_ts = int(time.time())
    start_ts = end_ts - (7 * 24 * 60 * 60)
    candle = _request_json(
        f'{FINNHUB_BASE_URL}/stock/candle',
        {
            'symbol': symbol,
            'resolution': 'D',
            'from': start_ts,
            'to': end_ts,
            'token': token,
        },
        'finnhub',
    )

    volume = None
    if isinstance(candle, dict) and candle.get('s') == 'ok':
        vols = candle.get('v', [])
        if vols:
            volume = _safe_int(vols[-1])

    market_cap_million = _safe_float(metrics.get('marketCapitalization'))
    market_cap = int(market_cap_million * 1_000_000) if market_cap_million is not None else None

    return {
        'symbol': symbol,
        'current_price': current,
        'previous_close': previous_close,
        'open': _safe_float(quote.get('o')),
        'day_high': _safe_float(quote.get('h')),
        'day_low': _safe_float(quote.get('l')),
        'volume': volume,
        'market_cap': market_cap,
        'name': profile.get('name') if isinstance(profile, dict) else symbol,
        'source': 'finnhub',
        'market_metrics': {
            'pe_ttm': _safe_float(metrics.get('peTTM')),
            'beta': _safe_float(metrics.get('beta')),
            'high_52_week': _safe_float(metrics.get('52WeekHigh')),
            'low_52_week': _safe_float(metrics.get('52WeekLow')),
        },
    }


def _finnhub_history(symbol, period='1mo', interval='1d'):
    token = settings.FINNHUB_API_KEY
    if not token:
        raise ProviderError('Finnhub API key missing')

    end_ts = int(time.time())
    start_ts = end_ts - (_period_days(period) * 24 * 60 * 60)
    resolution = _finnhub_resolution(interval)

    payload = _request_json(
        f'{FINNHUB_BASE_URL}/stock/candle',
        {
            'symbol': symbol,
            'resolution': resolution,
            'from': start_ts,
            'to': end_ts,
            'token': token,
        },
        'finnhub',
    )

    if not isinstance(payload, dict) or payload.get('s') != 'ok':
        raise ProviderError(f'Finnhub has no candle data for {symbol}')

    timestamps = payload.get('t', [])
    opens = payload.get('o', [])
    highs = payload.get('h', [])
    lows = payload.get('l', [])
    closes = payload.get('c', [])
    volumes = payload.get('v', [])

    history = []
    for idx, ts_value in enumerate(timestamps):
        dt = datetime.fromtimestamp(int(ts_value), tz=timezone.utc)
        history.append(
            {
                'date': dt.strftime('%Y-%m-%d'),
                'open': round(float(opens[idx]), 2),
                'high': round(float(highs[idx]), 2),
                'low': round(float(lows[idx]), 2),
                'close': round(float(closes[idx]), 2),
                'volume': _safe_int(volumes[idx]) or 0,
            }
        )

    if not history:
        raise ProviderError(f'Finnhub has no candle points for {symbol}')

    return history


def _alpha_price(symbol):
    api_key = settings.ALPHA_VANTAGE_API_KEY
    if not api_key:
        raise ProviderError('Alpha Vantage API key missing')

    quote_payload = _request_json(
        ALPHA_BASE_URL,
        {'function': 'GLOBAL_QUOTE', 'symbol': symbol, 'apikey': api_key},
        'alpha_vantage',
    )
    quote = quote_payload.get('Global Quote', {}) if isinstance(quote_payload, dict) else {}
    if not quote:
        raise ProviderError(f'Alpha Vantage has no quote data for {symbol}')

    overview_payload = _request_json(
        ALPHA_BASE_URL,
        {'function': 'OVERVIEW', 'symbol': symbol, 'apikey': api_key},
        'alpha_vantage',
    )

    return {
        'symbol': symbol,
        'current_price': _safe_float(quote.get('05. price')),
        'previous_close': _safe_float(quote.get('08. previous close')),
        'open': _safe_float(quote.get('02. open')),
        'day_high': _safe_float(quote.get('03. high')),
        'day_low': _safe_float(quote.get('04. low')),
        'volume': _safe_int(quote.get('06. volume')),
        'market_cap': _safe_int(overview_payload.get('MarketCapitalization'))
        if isinstance(overview_payload, dict)
        else None,
        'name': overview_payload.get('Name') if isinstance(overview_payload, dict) else symbol,
        'source': 'alpha_vantage',
        'market_metrics': {
            'pe_ttm': _safe_float(overview_payload.get('PERatio'))
            if isinstance(overview_payload, dict)
            else None,
            'beta': _safe_float(overview_payload.get('Beta'))
            if isinstance(overview_payload, dict)
            else None,
            'high_52_week': _safe_float(overview_payload.get('52WeekHigh'))
            if isinstance(overview_payload, dict)
            else None,
            'low_52_week': _safe_float(overview_payload.get('52WeekLow'))
            if isinstance(overview_payload, dict)
            else None,
        },
    }


def _alpha_history(symbol, period='1mo'):
    api_key = settings.ALPHA_VANTAGE_API_KEY
    if not api_key:
        raise ProviderError('Alpha Vantage API key missing')

    payload = _request_json(
        ALPHA_BASE_URL,
        {
            'function': 'TIME_SERIES_DAILY_ADJUSTED',
            'symbol': symbol,
            'outputsize': 'full',
            'apikey': api_key,
        },
        'alpha_vantage',
    )
    series = payload.get('Time Series (Daily)', {}) if isinstance(payload, dict) else {}
    if not series:
        raise ProviderError(f'Alpha Vantage has no historical data for {symbol}')

    points = PERIOD_TO_TRADING_POINTS.get(period, 22)
    selected_dates = sorted(series.keys(), reverse=True)[:points]
    selected_dates = sorted(selected_dates)

    history = []
    for date_key in selected_dates:
        row = series.get(date_key, {})
        history.append(
            {
                'date': date_key,
                'open': round(float(row.get('1. open', 0.0)), 2),
                'high': round(float(row.get('2. high', 0.0)), 2),
                'low': round(float(row.get('3. low', 0.0)), 2),
                'close': round(float(row.get('4. close', 0.0)), 2),
                'volume': _safe_int(row.get('6. volume')) or 0,
            }
        )

    if not history:
        raise ProviderError(f'Alpha Vantage returned empty historical data for {symbol}')

    return history


def _yfinance_price(symbol):
    _configure_yfinance_cache()
    ticker = yf.Ticker(symbol)
    try:
        fast = ticker.fast_info
        if fast:
            return {
                'symbol': symbol,
                'current_price': round(fast.last_price, 2) if fast.last_price else None,
                'previous_close': round(fast.previous_close, 2) if fast.previous_close else None,
                'open': round(fast.open, 2) if fast.open else None,
                'day_high': round(fast.day_high, 2) if fast.day_high else None,
                'day_low': round(fast.day_low, 2) if fast.day_low else None,
                'volume': _safe_int(fast.three_month_average_volume),
                'market_cap': _safe_int(fast.market_cap),
                'name': symbol,
                'source': 'yfinance',
                'market_metrics': {
                    'pe_ttm': None,
                    'beta': None,
                    'high_52_week': None,
                    'low_52_week': None,
                },
            }
    except Exception:
        pass

    try:
        info = ticker.info
    except Exception as exc:
        raise ProviderError(f'yfinance quote fetch failed for {symbol}: {exc}')

    if not info:
        raise ProviderError(f'yfinance has no quote data for {symbol}')

    return {
        'symbol': symbol,
        'current_price': _safe_float(info.get('currentPrice') or info.get('regularMarketPrice')),
        'previous_close': _safe_float(info.get('previousClose')),
        'open': _safe_float(info.get('open')),
        'day_high': _safe_float(info.get('dayHigh')),
        'day_low': _safe_float(info.get('dayLow')),
        'volume': _safe_int(info.get('volume')),
        'market_cap': _safe_int(info.get('marketCap')),
        'name': info.get('longName') or info.get('shortName') or symbol,
        'source': 'yfinance',
        'market_metrics': {
            'pe_ttm': _safe_float(info.get('trailingPE')),
            'beta': _safe_float(info.get('beta')),
            'high_52_week': _safe_float(info.get('fiftyTwoWeekHigh')),
            'low_52_week': _safe_float(info.get('fiftyTwoWeekLow')),
        },
    }


def _yfinance_history(symbol, period='1mo', interval='1d'):
    _configure_yfinance_cache()
    ticker = yf.Ticker(symbol)
    try:
        hist = ticker.history(period=period, interval=interval)
    except Exception as exc:
        raise ProviderError(f'yfinance history fetch failed for {symbol}: {exc}')
    if hist.empty:
        raise ProviderError(f'yfinance has no historical data for {symbol}')

    history = []
    for date, row in hist.iterrows():
        history.append(
            {
                'date': str(date.date()),
                'open': round(float(row['Open']), 2),
                'high': round(float(row['High']), 2),
                'low': round(float(row['Low']), 2),
                'close': round(float(row['Close']), 2),
                'volume': _safe_int(row['Volume']) or 0,
            }
        )
    return history


def get_price_data(symbol, default_name=None):
    cache_key = f'stock-price:{symbol.upper()}'
    cached = cache.get(cache_key)
    if cached:
        return cached

    providers = [
        ('finnhub', _finnhub_price),
        ('alpha_vantage', _alpha_price),
        ('yfinance', _yfinance_price),
    ]
    errors = []
    saw_rate_limit = False

    for provider_name, provider in providers:
        try:
            payload = provider(symbol.upper())
            if default_name and not payload.get('name'):
                payload['name'] = default_name
            payload.setdefault('symbol', symbol.upper())
            payload.setdefault('name', default_name or symbol.upper())
            payload['provider_fallback_used'] = payload.get('source') != 'finnhub'
            cache.set(cache_key, payload, PRICE_CACHE_TTL_SECONDS)
            return payload
        except ProviderError as exc:
            errors.append(f'{provider_name}: {exc}')
            saw_rate_limit = saw_rate_limit or exc.rate_limited
            if exc.rate_limited:
                logger.warning('Rate limit from %s for %s: %s', provider_name, symbol, exc)
            else:
                logger.info('Provider failure from %s for %s: %s', provider_name, symbol, exc)
        except Exception as exc:
            errors.append(f'{provider_name}: {exc}')
            logger.exception('Unexpected provider failure from %s for %s', provider_name, symbol)

    raise ProviderError(
        f'Could not fetch price for {symbol}. Details: {" | ".join(errors)}',
        rate_limited=saw_rate_limit,
    )


def get_history_data(symbol, period='1mo', interval='1d'):
    cache_key = f'stock-history:{symbol.upper()}:{period}:{interval}'
    cached = cache.get(cache_key)
    if cached:
        return cached

    providers = [
        (
            'finnhub',
            lambda current_symbol: _finnhub_history(
                current_symbol, period=period, interval=interval
            ),
        ),
        (
            'alpha_vantage',
            lambda current_symbol: _alpha_history(current_symbol, period=period),
        ),
        (
            'yfinance',
            lambda current_symbol: _yfinance_history(
                current_symbol, period=period, interval=interval
            ),
        ),
    ]

    errors = []
    saw_rate_limit = False
    for provider_name, provider in providers:
        try:
            history = provider(symbol.upper())
            payload = {
                'symbol': symbol.upper(),
                'period': period,
                'interval': interval,
                'history': history,
                'source': provider_name,
            }
            payload['provider_fallback_used'] = payload['source'] != 'finnhub'
            cache.set(cache_key, payload, HISTORY_CACHE_TTL_SECONDS)
            return payload
        except ProviderError as exc:
            errors.append(f'{provider_name}: {exc}')
            saw_rate_limit = saw_rate_limit or exc.rate_limited
            if exc.rate_limited:
                logger.warning('Rate limit from %s for %s history: %s', provider_name, symbol, exc)
            else:
                logger.info('Provider failure from %s for %s history: %s', provider_name, symbol, exc)
        except Exception as exc:
            errors.append(f'{provider_name}: {exc}')
            logger.exception('Unexpected provider failure from %s for %s history', provider_name, symbol)

    raise ProviderError(
        f'Could not fetch history for {symbol}. Details: {" | ".join(errors)}',
        rate_limited=saw_rate_limit,
    )
