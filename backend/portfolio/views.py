"""
portfolio/views.py
API endpoints for sector-based portfolio data.
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from .portfolio_service import (
    build_portfolio,
    get_portfolio_by_country,
    get_portfolio_by_sector,
    get_portfolio_stats,
    get_top_sectors,
    get_all_sectors,
    invalidate_cache,
)
import logging

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_all_portfolios(request):
    """
    GET /api/portfolios/
    Returns full portfolio grouped by country and sector.
    """
    try:
        portfolio = build_portfolio()
        stats = get_portfolio_stats()

        return Response({
            'stats': stats,
            'portfolio': portfolio,
        })

    except Exception as e:
        logger.error(f"get_all_portfolios error: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def get_country_portfolio(request, country):
    """
    GET /api/portfolios/<country>/
    Returns portfolio for a specific country (India or US).
    """
    try:
        # Normalize country name
        country_map = {
            'india': 'India',
            'in': 'India',
            'us': 'US',
            'usa': 'US',
            'united states': 'US',
        }
        normalized_country = country_map.get(
            country.lower(), country.title()
        )

        data = get_portfolio_by_country(normalized_country)

        if not data:
            return Response(
                {'error': f'No portfolio found for {country}'},
                status=status.HTTP_404_NOT_FOUND
            )

        top_sectors = get_top_sectors(country=normalized_country)

        return Response({
            'country': normalized_country,
            'total_sectors': len(data),
            'total_stocks': sum(len(s) for s in data.values()),
            'top_sectors': [
                {'sector': s, 'count': c} for s, c in top_sectors
            ],
            'sectors': data,
        })

    except Exception as e:
        logger.error(f"get_country_portfolio error: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def get_sector_portfolio(request, sector):
    """
    GET /api/portfolio/<sector>/
    Returns all stocks in a specific sector across all countries.
    """
    try:
        country = request.query_params.get('country', None)
        data = get_portfolio_by_sector(sector, country=country)

        if not data:
            available = get_all_sectors()
            return Response({
                'error': f'Sector "{sector}" not found',
                'available_sectors': available,
            }, status=status.HTTP_404_NOT_FOUND)

        total_stocks = sum(len(s) for s in data.values())

        return Response({
            'sector': sector,
            'total_stocks': total_stocks,
            'countries': data,
        })

    except Exception as e:
        logger.error(f"get_sector_portfolio error: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def get_portfolio_overview(request):
    """
    GET /api/portfolios/stats/
    Returns stats overview — useful for dashboard widgets.
    """
    try:
        stats = get_portfolio_stats()
        top_india = get_top_sectors(country='India', top_n=5)
        top_us = get_top_sectors(country='US', top_n=5)

        return Response({
            'stats': stats,
            'top_sectors': {
                'India': [{'sector': s, 'count': c} for s, c in top_india],
                'US': [{'sector': s, 'count': c} for s, c in top_us],
            }
        })

    except Exception as e:
        logger.error(f"get_portfolio_overview error: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_portfolio(request):
    """
    POST /api/portfolios/refresh/
    Invalidates cache and rebuilds portfolio.
    """
    try:
        invalidate_cache()
        portfolio = build_portfolio()
        stats = get_portfolio_stats()
        return Response({
            'message': 'Portfolio refreshed successfully',
            'stats': stats,
        })
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )