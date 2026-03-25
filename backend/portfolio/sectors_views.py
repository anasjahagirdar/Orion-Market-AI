"""
portfolio/sectors_views.py
Lightweight API to expose sector names by market from sector_mapping.json.
"""

import json
from pathlib import Path

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


SECTOR_MAPPING_FILE = Path(settings.BASE_DIR) / 'data' / 'sector_mapping.json'


def _normalize_market(value):
    normalized = str(value or '').strip().lower()
    if normalized in {'indian', 'india', 'in'}:
        return 'indian'
    if normalized in {'international', 'global', 'us', 'intl'}:
        return 'international'
    return None


@api_view(['GET'])
@permission_classes([AllowAny])
def get_market_sectors(request, market):
    """
    GET /api/sectors/<market>/
    Returns available sector names for the provided market.
    """
    market_key = _normalize_market(market)
    if market_key is None:
        return Response(
            {'error': f'Invalid market "{market}". Use indian or international.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not SECTOR_MAPPING_FILE.exists():
        return Response(
            {
                'error': 'sector_mapping.json not found',
                'mapping_file': str(SECTOR_MAPPING_FILE),
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        payload = json.loads(SECTOR_MAPPING_FILE.read_text(encoding='utf-8'))
    except json.JSONDecodeError as exc:
        return Response(
            {'error': f'Invalid mapping JSON: {exc}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    market_payload = payload.get(market_key, {})
    sectors_map = market_payload.get('sectors', {})
    if not isinstance(sectors_map, dict):
        return Response(
            {
                'error': f'Invalid sector mapping format for market "{market_key}"',
                'market': market_key,
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    sectors = list(sectors_map.keys())
    return Response(
        {
            'market': market_key,
            'sectors': sectors,
            'count': len(sectors),
        }
    )
