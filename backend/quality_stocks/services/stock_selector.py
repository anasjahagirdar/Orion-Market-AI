import logging
from collections import defaultdict

import yfinance as yf

from stocks.market_data_service import _configure_yfinance_cache
from quality_stocks.models import QualityStock, StockFinancialSnapshot

logger = logging.getLogger(__name__)

SECTORS = [
    'Technology', 'Finance', 'Healthcare', 'Energy',
    'Consumer Goods', 'Industrials', 'Telecommunications',
    'Real Estate', 'Materials', 'Utilities',
]

SECTOR_CANDIDATES = {
    'Technology': ['INFY.NS', 'TCS.NS', 'WIPRO.NS', 'HCLTECH.NS', 'AAPL', 'MSFT', 'GOOGL', 'NVDA'],
    'Finance': ['HDFCBANK.NS', 'ICICIBANK.NS', 'KOTAKBANK.NS', 'SBIN.NS', 'JPM', 'BAC', 'GS'],
    'Healthcare': ['SUNPHARMA.NS', 'DRREDDY.NS', 'CIPLA.NS', 'JNJ', 'PFE', 'UNH', 'ABBV'],
    'Energy': ['RELIANCE.NS', 'ONGC.NS', 'XOM', 'CVX', 'COP', 'SLB'],
    'Consumer Goods': ['HINDUNILVR.NS', 'ITC.NS', 'NESTLEIND.NS', 'PG', 'KO', 'PEP', 'COST'],
    'Industrials': ['LT.NS', 'SIEMENS.NS', 'BA', 'CAT', 'HON', 'GE'],
    'Telecommunications': ['BHARTIARTL.NS', 'VZ', 'T', 'TMUS'],
    'Real Estate': ['DLF.NS', 'GODREJPROP.NS', 'AMT', 'PLD', 'SPG'],
    'Materials': ['JSWSTEEL.NS', 'TATASTEEL.NS', 'LIN', 'APD', 'NEM'],
    'Utilities': ['NTPC.NS', 'POWERGRID.NS', 'NEE', 'DUK', 'SO'],
}

METRIC_CONFIG = {
    'roe': {'weight': 0.25, 'invert': False},
    'profit_margin': {'weight': 0.20, 'invert': False},
    'revenue_growth_yoy': {'weight': 0.20, 'invert': False},
    'pe_ratio': {'weight': 0.15, 'invert': True},
    'beta': {'weight': 0.10, 'invert': True},
    'dividend_yield': {'weight': 0.10, 'invert': False},
}


def _safe_float(value):
    try:
        if value in (None, '', 'None'):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_int(value):
    try:
        if value in (None, '', 'None'):
            return None
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _to_percent(value):
    numeric = _safe_float(value)
    if numeric is None:
        return None
    if -1.0 <= numeric <= 1.0:
        return numeric * 100.0
    return numeric


def _parse_history(history_df):
    rows = []
    for date, row in history_df.iterrows():
        try:
            rows.append(
                {
                    'date': str(date.date()),
                    'open': round(float(row['Open']), 2),
                    'high': round(float(row['High']), 2),
                    'low': round(float(row['Low']), 2),
                    'close': round(float(row['Close']), 2),
                    'volume': _safe_int(row['Volume']) or 0,
                }
            )
        except Exception:
            continue
    return rows


def _resolve_market_exchange(ticker, info):
    if ticker.endswith('.NS'):
        return 'IN', 'NSE'
    if ticker.endswith('.BO'):
        return 'IN', 'BSE'

    exchange_raw = str(info.get('exchange') or '').upper()
    if 'NAS' in exchange_raw or exchange_raw in {'NMS', 'NGM'}:
        exchange = 'NASDAQ'
    elif 'NYS' in exchange_raw:
        exchange = 'NYSE'
    else:
        exchange = 'NASDAQ'
    return 'US', exchange


def _extract_metrics(info):
    return {
        'roe': _to_percent(info.get('returnOnEquity')),
        'profit_margin': _to_percent(info.get('profitMargins')),
        'revenue_growth_yoy': _to_percent(info.get('revenueGrowth')),
        'pe_ratio': _safe_float(info.get('trailingPE')),
        'beta': _safe_float(info.get('beta')),
        'dividend_yield': _to_percent(info.get('dividendYield')),
    }


def _normalize_candidates(candidates):
    for metric_name, config in METRIC_CONFIG.items():
        values = [
            c['metrics'][metric_name]
            for c in candidates
            if c['metrics'][metric_name] is not None
        ]
        if not values:
            for candidate in candidates:
                candidate['normalized'][metric_name] = None
            continue

        min_value = min(values)
        max_value = max(values)
        span = max_value - min_value

        for candidate in candidates:
            value = candidate['metrics'][metric_name]
            if value is None:
                candidate['normalized'][metric_name] = None
                continue

            if span == 0:
                normalized = 1.0
            elif config['invert']:
                normalized = (max_value - value) / span
            else:
                normalized = (value - min_value) / span

            candidate['normalized'][metric_name] = max(0.0, min(1.0, normalized))

    for candidate in candidates:
        available_weights = [
            METRIC_CONFIG[name]['weight']
            for name, value in candidate['normalized'].items()
            if value is not None
        ]
        total_weight = sum(available_weights)
        if total_weight == 0:
            candidate['quality_score'] = 0.0
            continue

        weighted_sum = 0.0
        for metric_name, normalized in candidate['normalized'].items():
            if normalized is None:
                continue
            adjusted_weight = METRIC_CONFIG[metric_name]['weight'] / total_weight
            weighted_sum += adjusted_weight * normalized

        candidate['quality_score'] = round(weighted_sum * 100.0, 2)


def _fetch_candidate_payload(sector, ticker):
    try:
        yf_ticker = yf.Ticker(ticker)
    except Exception as exc:
        logger.warning(f'Skipping {ticker}: {exc}')
        return None

    try:
        info = yf_ticker.info or {}
    except Exception as exc:
        logger.warning(f'Skipping {ticker}: {exc}')
        return None

    try:
        history_df = yf_ticker.history(period='6mo', interval='1d')
    except Exception as exc:
        logger.warning(f'Skipping {ticker}: {exc}')
        return None

    if history_df is None or history_df.empty:
        logger.warning(f'Skipping {ticker}: empty history')
        return None

    metrics = _extract_metrics(info)
    if all(value is None for value in metrics.values()):
        logger.warning(f'Skipping {ticker}: no quality metrics available')
        return None

    market, exchange = _resolve_market_exchange(ticker, info)
    price_history_json = _parse_history(history_df)
    if not price_history_json:
        logger.warning(f'Skipping {ticker}: invalid history rows')
        return None

    current_price = _safe_float(info.get('currentPrice') or info.get('regularMarketPrice'))
    if current_price is None and price_history_json:
        current_price = price_history_json[-1].get('close')

    return {
        'ticker': ticker.upper(),
        'name': info.get('longName') or info.get('shortName') or ticker.upper(),
        'sector': sector,
        'market': market,
        'exchange': exchange,
        'metrics': metrics,
        'normalized': {},
        'quality_score': 0.0,
        'financials': {
            'current_price': current_price,
            'market_cap': _safe_int(info.get('marketCap')),
            'pe_ratio': _safe_float(info.get('trailingPE')),
            'pb_ratio': _safe_float(info.get('priceToBook')),
            'eps': _safe_float(info.get('trailingEps')),
            'revenue_growth_yoy': metrics['revenue_growth_yoy'],
            'profit_margin': metrics['profit_margin'],
            'roe': metrics['roe'],
            'debt_to_equity': _safe_float(info.get('debtToEquity')),
            'dividend_yield': metrics['dividend_yield'],
            'week_52_high': _safe_float(info.get('fiftyTwoWeekHigh')),
            'week_52_low': _safe_float(info.get('fiftyTwoWeekLow')),
            'avg_volume': _safe_int(info.get('averageVolume')),
            'beta': metrics['beta'],
            'price_history_json': price_history_json,
        },
    }


def select_quality_stocks():
    _configure_yfinance_cache()

    candidates = []
    for sector in SECTORS:
        tickers = SECTOR_CANDIDATES.get(sector, [])
        for ticker in tickers:
            payload = _fetch_candidate_payload(sector=sector, ticker=ticker)
            if payload:
                candidates.append(payload)

    if not candidates:
        logger.warning('No quality stock candidates were collected.')
        return []

    _normalize_candidates(candidates)

    grouped = defaultdict(list)
    for candidate in candidates:
        grouped[candidate['sector']].append(candidate)

    selected_tickers = []
    selected_objects = []

    for sector in SECTORS:
        sector_candidates = sorted(
            grouped.get(sector, []),
            key=lambda item: item['quality_score'],
            reverse=True,
        )
        top_sector_candidates = sector_candidates[:4]

        for rank, candidate in enumerate(top_sector_candidates, start=1):
            stock_obj, _ = QualityStock.objects.update_or_create(
                ticker=candidate['ticker'],
                defaults={
                    'name': candidate['name'],
                    'sector': sector,
                    'market': candidate['market'],
                    'exchange': candidate['exchange'],
                    'quality_score': candidate['quality_score'],
                    'rank_in_sector': rank,
                    'is_active': True,
                },
            )

            StockFinancialSnapshot.objects.update_or_create(
                stock=stock_obj,
                defaults=candidate['financials'],
            )

            selected_tickers.append(stock_obj.ticker)
            selected_objects.append(stock_obj)

    QualityStock.objects.exclude(ticker__in=selected_tickers).update(is_active=False)

    return selected_objects
