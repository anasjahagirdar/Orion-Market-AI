"""
sector_grouping.py
Normalizes and groups stocks by sector and country.
Imports stock data from existing Django Stock model (loaded by load_stocks.py)
"""

# ─── Sector Normalization Map ─────────────────────────────────────────────────
SECTOR_ALIASES = {
    # Technology
    'it': 'Technology',
    'tech': 'Technology',
    'technology': 'Technology',
    'information technology': 'Technology',
    'software': 'Technology',
    'hardware': 'Technology',
    'semiconductors': 'Technology',

    # Banking & Finance
    'bank': 'Banking & Finance',
    'banking': 'Banking & Finance',
    'banks': 'Banking & Finance',
    'financial services': 'Banking & Finance',
    'financials': 'Banking & Finance',
    'finance': 'Banking & Finance',
    'insurance': 'Banking & Finance',
    'diversified financials': 'Banking & Finance',

    # Healthcare
    'health': 'Healthcare',
    'healthcare': 'Healthcare',
    'pharma': 'Healthcare',
    'pharmaceuticals': 'Healthcare',
    'biotechnology': 'Healthcare',
    'medical': 'Healthcare',
    'life sciences': 'Healthcare',

    # Energy
    'energy': 'Energy',
    'oil': 'Energy',
    'oil & gas': 'Energy',
    'gas': 'Energy',
    'utilities': 'Energy',
    'power': 'Energy',

    # Consumer
    'consumer': 'Consumer',
    'consumer goods': 'Consumer',
    'consumer discretionary': 'Consumer',
    'consumer staples': 'Consumer',
    'fmcg': 'Consumer',
    'retail': 'Consumer',
    'e-commerce': 'Consumer',

    # Industrials
    'industrial': 'Industrials',
    'industrials': 'Industrials',
    'capital goods': 'Industrials',
    'manufacturing': 'Industrials',
    'engineering': 'Industrials',
    'construction': 'Industrials',
    'infrastructure': 'Industrials',
    'construction materials': 'Industrials',

    # Real Estate
    'real estate': 'Real Estate',
    'realty': 'Real Estate',
    'reit': 'Real Estate',

    # Materials
    'materials': 'Materials',
    'metals': 'Materials',
    'metals & mining': 'Materials',
    'mining': 'Materials',
    'chemicals': 'Materials',
    'cement': 'Materials',

    # Communication
    'communication': 'Communication',
    'telecom': 'Communication',
    'telecommunications': 'Communication',
    'media': 'Communication',
    'entertainment': 'Communication',

    # Automobile
    'auto': 'Automobile',
    'automobile': 'Automobile',
    'automotive': 'Automobile',
    'vehicles': 'Automobile',
}


def normalize_sector(sector):
    """
    Normalize a sector name to a standard category.
    Returns 'Other' if no match found.
    """
    if not sector:
        return 'Other'

    normalized = sector.strip().lower()

    # Direct match
    if normalized in SECTOR_ALIASES:
        return SECTOR_ALIASES[normalized]

    # Partial match
    for key, value in SECTOR_ALIASES.items():
        if key in normalized or normalized in key:
            return value

    # Capitalize first letter of original if no match
    return sector.strip().title() if sector.strip() else 'Other'


def normalize_market_to_country(market):
    """Convert market code to country name"""
    mapping = {
        'IN': 'India',
        'US': 'US',
        'CRYPTO': 'Crypto',
    }
    return mapping.get(market.upper(), market)


def group_stocks_by_sector(stocks_queryset):
    """
    Takes a Django queryset or list of Stock objects.
    Returns grouped portfolio dict:
    {
        "India": {
            "Technology": [{"symbol": ..., "name": ..., "sector": ...}],
            ...
        },
        "US": { ... }
    }
    """
    portfolio = {}

    for stock in stocks_queryset:
        # Get country from market field
        country = normalize_market_to_country(stock.market)

        # Normalize the sector
        normalized_sector = normalize_sector(stock.sector)

        # Build nested dict
        if country not in portfolio:
            portfolio[country] = {}

        if normalized_sector not in portfolio[country]:
            portfolio[country][normalized_sector] = []

        portfolio[country][normalized_sector].append({
            'symbol': stock.symbol,
            'name': stock.name,
            'sector': normalized_sector,
            'original_sector': stock.sector,
            'market': stock.market,
        })

    return portfolio


def get_sector_summary(portfolio):
    """
    Returns a summary of sector counts per country.
    {
        "India": {"Technology": 45, "Banking": 30, ...},
        "US": {...}
    }
    """
    summary = {}
    for country, sectors in portfolio.items():
        summary[country] = {
            sector: len(stocks)
            for sector, stocks in sectors.items()
        }
    return summary