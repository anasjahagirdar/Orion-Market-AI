"""
portfolio/views.py
API endpoints for sector-based portfolio data.
"""

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from .portfolio_service import (
    build_portfolio,
    get_portfolio_by_country,
    get_portfolio_stats,
    get_top_sectors,
    invalidate_cache,
)
import logging

logger = logging.getLogger(__name__)


PORTFOLIO_OUTPUT_DIR = Path(settings.BASE_DIR) / 'data' / 'portfolio_outputs'
PORTFOLIO_MAPPING_FILE = Path(settings.BASE_DIR) / 'data' / 'sector_mapping.json'
PROJECT_ROOT_DIR = Path(settings.BASE_DIR).parent
PORTFOLIO_SCRIPT_SH = PROJECT_ROOT_DIR / 'scripts' / 'generate_portfolios.sh'
PORTFOLIO_SCRIPT_PY = PROJECT_ROOT_DIR / 'scripts' / 'generate_portfolios.py'


def _slugify_sector_name(value):
    return re.sub(r'[^a-z0-9]+', '_', value.lower()).strip('_')


def _normalize_market(value):
    normalized = str(value or '').strip().lower()
    if normalized in {'indian', 'india', 'in'}:
        return 'indian'
    if normalized in {'international', 'global', 'us', 'intl'}:
        return 'international'
    if normalized in {'all', '*'}:
        return 'all'
    return None


def _available_sector_files(market=None):
    if not PORTFOLIO_OUTPUT_DIR.exists():
        return []
    if market:
        market_dir = PORTFOLIO_OUTPUT_DIR / market
        if not market_dir.exists():
            return []
        return sorted(
            [
                item.stem
                for item in market_dir.glob('*.json')
                if item.is_file()
            ]
        )
    files = []
    for market_key in ('indian', 'international'):
        for sector in _available_sector_files(market_key):
            files.append(f'{market_key}/{sector}')
    return sorted(files)


def _resolve_sector_file(sector, market):
    market_key = _normalize_market(market)
    if market_key not in {'indian', 'international'}:
        return None
    slug = _slugify_sector_name(sector)
    candidate = PORTFOLIO_OUTPUT_DIR / market_key / f'{slug}.json'
    if candidate.exists():
        return candidate
    return None


def _run_portfolio_recompute(market='all'):
    if not PORTFOLIO_MAPPING_FILE.exists():
        raise FileNotFoundError(f'Mapping file not found: {PORTFOLIO_MAPPING_FILE}')

    PORTFOLIO_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    market_key = _normalize_market(market)
    if market_key is None:
        raise ValueError(f'Invalid market "{market}". Use indian, international, or all.')

    bash_bin = shutil.which('bash')
    if bash_bin and PORTFOLIO_SCRIPT_SH.exists():
        command = [bash_bin, str(PORTFOLIO_SCRIPT_SH), '--market', market_key]
        runner = 'bash'
    elif PORTFOLIO_SCRIPT_PY.exists():
        command = [
            sys.executable,
            str(PORTFOLIO_SCRIPT_PY),
            '--mapping',
            str(PORTFOLIO_MAPPING_FILE),
            '--output',
            str(PORTFOLIO_OUTPUT_DIR),
            '--market',
            market_key,
        ]
        runner = 'python'
    else:
        raise FileNotFoundError(
            f'No generator script found at {PORTFOLIO_SCRIPT_SH} or {PORTFOLIO_SCRIPT_PY}'
        )

    completed = subprocess.run(
        command,
        cwd=str(PROJECT_ROOT_DIR),
        capture_output=True,
        text=True,
        timeout=600,
    )

    if completed.returncode != 0:
        raise RuntimeError(
            f'Portfolio recompute failed ({runner}): {completed.stderr.strip() or completed.stdout.strip()}'
        )

    return {
        'runner': runner,
        'stdout': completed.stdout.strip(),
        'stderr': completed.stderr.strip(),
        'market': market_key,
    }


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
    Legacy endpoint: resolves sector from international first, then indian.
    """
    try:
        sector_file = _resolve_sector_file(sector, 'international')
        resolved_market = 'international'
        if not sector_file:
            sector_file = _resolve_sector_file(sector, 'indian')
            resolved_market = 'indian'

        if not sector_file:
            available_files = _available_sector_files(None)
            return Response(
                {
                    'error': f'Sector "{sector}" not found',
                    'available_sectors': available_files,
                    'output_directory': str(PORTFOLIO_OUTPUT_DIR),
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        payload = json.loads(sector_file.read_text(encoding='utf-8'))
        payload.setdefault('source', 'stored_portfolio_file')
        payload.setdefault('file', sector_file.name)
        payload.setdefault('market', resolved_market)
        payload.setdefault(
            'legacy_notice',
            'Use /api/portfolio/<market>/<sector>/ for explicit market-scoped reads.'
        )
        return Response(payload)

    except Exception as e:
        logger.error(f"get_sector_portfolio error: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def get_market_sector_portfolio(request, market, sector):
    """
    GET /api/portfolio/<market>/<sector>/
    Loads stored ML portfolio JSON from market-specific subfolders.
    """
    try:
        market_key = _normalize_market(market)
        if market_key not in {'indian', 'international'}:
            return Response(
                {'error': f'Invalid market "{market}". Use indian or international.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sector_file = _resolve_sector_file(sector, market_key)
        if not sector_file:
            available_files = _available_sector_files(market_key)
            return Response(
                {
                    'error': True,
                    'message': 'Portfolio not yet generated for this sector. Please run the generation script.',
                    'sector': str(sector),
                    'market': market_key,
                    'available_sectors': available_files,
                    'output_directory': str(PORTFOLIO_OUTPUT_DIR / market_key),
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        payload = json.loads(sector_file.read_text(encoding='utf-8'))
        payload.setdefault('source', 'stored_portfolio_file')
        payload.setdefault('file', sector_file.name)
        payload['market'] = market_key
        return Response(payload)

    except Exception as e:
        logger.error(f"get_market_sector_portfolio error: {e}")
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


@api_view(['POST'])
@permission_classes([AllowAny])
def recompute_portfolio(request):
    """
    POST /api/recompute-portfolio/
    Regenerates persisted sector portfolio output files for all markets.
    """
    return _recompute_portfolio_response('all')


def _recompute_portfolio_response(market):
    try:
        result = _run_portfolio_recompute(market=market)
        market_key = result['market']
        if market_key == 'all':
            files = _available_sector_files(None)
        else:
            files = _available_sector_files(market_key)
        return Response(
            {
                'message': 'Portfolio recomputed successfully',
                'runner': result['runner'],
                'market': market_key,
                'output_directory': str(PORTFOLIO_OUTPUT_DIR if market_key == 'all' else PORTFOLIO_OUTPUT_DIR / market_key),
                'sector_files': files,
                'sector_count': len(files),
            }
        )
    except ValueError as exc:
        logger.error(f'recompute_portfolio invalid market: {exc}')
        return Response(
            {'error': str(exc)},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except FileNotFoundError as exc:
        logger.error(f'recompute_portfolio missing dependency: {exc}')
        return Response(
            {'error': str(exc)},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except subprocess.TimeoutExpired:
        logger.error('recompute_portfolio timed out')
        return Response(
            {'error': 'Portfolio recompute timed out'},
            status=status.HTTP_504_GATEWAY_TIMEOUT,
        )
    except Exception as exc:
        logger.error(f'recompute_portfolio error: {exc}')
        return Response(
            {'error': str(exc)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def recompute_portfolio_market(request, market):
    """
    POST /api/recompute-portfolio/<market>/
    market: indian | international | all
    """
    return _recompute_portfolio_response(market)
