"""
portfolio_service.py
Main service layer for portfolio operations.
Builds on top of existing Stock model and sector_grouping logic.
Does NOT duplicate stock loading — imports from existing DB.
"""

from stocks.models import Stock
from .sector_grouping import (
    group_stocks_by_sector,
    get_sector_summary,
    normalize_sector,
    normalize_market_to_country,
)
import logging

logger = logging.getLogger(__name__)

# ─── In-memory cache to avoid repeated DB queries ─────────────────────────────
_portfolio_cache = None


def build_portfolio(force_refresh=False):
    """
    Build the full sector-based portfolio from existing Stock model.
    Uses in-memory cache for performance.
    Does NOT reload stocks — uses what load_stocks.py already saved.
    """
    global _portfolio_cache

    if _portfolio_cache is not None and not force_refresh:
        return _portfolio_cache

    try:
        # Import from existing Stock model (already loaded by load_stocks.py)
        stocks = Stock.objects.filter(is_active=True).only(
            'symbol', 'name', 'market', 'sector'
        )

        if not stocks.exists():
            logger.warning("No stocks found in DB. Run load_stocks.py first.")
            return {}

        portfolio = group_stocks_by_sector(stocks)
        _portfolio_cache = portfolio
        logger.info(f"Portfolio built: {get_sector_summary(portfolio)}")
        return portfolio

    except Exception as e:
        logger.error(f"Error building portfolio: {e}")
        return {}


def get_portfolio_by_country(country):
    """
    Get all sectors and stocks for a specific country.
    country: 'India' or 'US'
    """
    portfolio = build_portfolio()
    return portfolio.get(country, {})


def get_portfolio_by_sector(sector, country=None):
    """
    Get all stocks in a specific sector.
    Optionally filter by country.
    """
    portfolio = build_portfolio()
    normalized = normalize_sector(sector)
    result = {}

    for c, sectors in portfolio.items():
        if country and c != country:
            continue
        if normalized in sectors:
            result[c] = sectors[normalized]

    return result


def get_all_sectors(country=None):
    """
    Get list of all available sectors.
    Optionally filter by country.
    """
    portfolio = build_portfolio()
    sectors = set()

    for c, sector_data in portfolio.items():
        if country and c != country:
            continue
        sectors.update(sector_data.keys())

    return sorted(list(sectors))


def get_portfolio_stats():
    """
    Get overall stats about the portfolio.
    Returns total stocks, sectors, and breakdown per country.
    """
    portfolio = build_portfolio()
    summary = get_sector_summary(portfolio)

    stats = {
        'total_stocks': Stock.objects.filter(is_active=True).count(),
        'countries': list(portfolio.keys()),
        'breakdown': {},
    }

    for country, sectors in summary.items():
        stats['breakdown'][country] = {
            'total_stocks': sum(sectors.values()),
            'total_sectors': len(sectors),
            'sectors': sectors,
        }

    return stats


def get_top_sectors(country=None, top_n=5):
    """
    Get top N sectors by stock count.
    Useful for chatbot: "What are the biggest sectors in India?"
    """
    portfolio = build_portfolio()
    sector_counts = {}

    for c, sectors in portfolio.items():
        if country and c != country:
            continue
        for sector, stocks in sectors.items():
            if sector not in sector_counts:
                sector_counts[sector] = 0
            sector_counts[sector] += len(stocks)

    sorted_sectors = sorted(
        sector_counts.items(),
        key=lambda x: x[1],
        reverse=True
    )
    return sorted_sectors[:top_n]


def invalidate_cache():
    """Call this when stocks are updated"""
    global _portfolio_cache
    _portfolio_cache = None
    logger.info("Portfolio cache invalidated")