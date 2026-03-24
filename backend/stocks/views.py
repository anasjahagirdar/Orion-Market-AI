from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q
from .models import Stock
from .market_data_service import ProviderError, get_history_data, get_price_data
import logging

logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_stocks(request):
    """Get list of all tracked stocks"""
    try:
        market = request.query_params.get('market', None)
        search = request.query_params.get('search', None)
        limit_param = request.query_params.get('limit', None)

        stocks = Stock.objects.filter(is_active=True)

        if market:
            stocks = stocks.filter(market=market.upper())

        if search:
            stocks = stocks.filter(
                Q(symbol__icontains=search) | Q(name__icontains=search)
            )

        default_limit = 500 if market else 100
        max_limit = 1000
        try:
            limit = int(limit_param) if limit_param else default_limit
        except (TypeError, ValueError):
            limit = default_limit
        limit = max(1, min(limit, max_limit))

        stocks = stocks.order_by('symbol').values(
            'id', 'symbol', 'name', 'market', 'sector'
        )[:limit]
        return Response({'stocks': list(stocks)})
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_stock_detail(request, symbol):
    """Get details for a specific stock"""
    try:
        stock = Stock.objects.get(symbol=symbol.upper())
        return Response({
            'id': stock.id,
            'symbol': stock.symbol,
            'name': stock.name,
            'market': stock.market,
            'sector': stock.sector,
        })
    except Stock.DoesNotExist:
        return Response({'error': 'Stock not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_stock_price(request, symbol):
    """Get current stock price with Finnhub -> Alpha Vantage -> yfinance fallback."""
    try:
        stock_name = None
        try:
            stock_name = Stock.objects.filter(symbol=symbol.upper()).values_list('name', flat=True).first()
        except Exception:
            stock_name = None

        price_data = get_price_data(symbol.upper(), default_name=stock_name)
        return Response(price_data)

    except ProviderError as e:
        if e.rate_limited:
            return Response(
                {
                    'error': str(e),
                    'code': 'rate_limited',
                    'retry_after_seconds': 60,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        return Response(
            {'error': str(e)},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )

    except Exception as e:
        logger.error(f"get_stock_price error for {symbol}: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_stock_history(request, symbol):
    """Get historical stock data with Finnhub -> Alpha Vantage -> yfinance fallback."""
    try:
        period = request.query_params.get('period', '1mo')
        interval = request.query_params.get('interval', '1d')
        payload = get_history_data(symbol.upper(), period=period, interval=interval)
        return Response(payload)

    except ProviderError as e:
        if e.rate_limited:
            return Response(
                {
                    'error': str(e),
                    'code': 'rate_limited',
                    'retry_after_seconds': 60,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        return Response(
            {'error': str(e)},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )

    except Exception as e:
        logger.error(f"get_stock_history error for {symbol}: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_watchlist(request):
    """Get user's watchlist"""
    try:
        from .models import Watchlist
        watchlist = Watchlist.objects.filter(
            user=request.user
        ).select_related('stock')

        data = [{
            'symbol': w.stock.symbol,
            'name': w.stock.name,
            'market': w.stock.market,
            'sector': w.stock.sector,
            'added_at': w.added_at,
            'notes': w.notes,
        } for w in watchlist]

        return Response({'watchlist': data, 'total': len(data)})

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_to_watchlist(request):
    """Add a stock to user's watchlist"""
    try:
        from .models import Watchlist
        symbol = request.data.get('symbol', '').upper()
        notes = request.data.get('notes', '')

        if not symbol:
            return Response(
                {'error': 'Symbol is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get or create stock
        try:
            stock = Stock.objects.get(symbol=symbol)
        except Stock.DoesNotExist:
            # Auto-create if not in DB
            stock = Stock.objects.create(
                symbol=symbol,
                name=symbol,
                market='US'
            )

        watchlist_item, created = Watchlist.objects.get_or_create(
            user=request.user,
            stock=stock,
            defaults={'notes': notes}
        )

        if not created:
            return Response(
                {'message': f'{symbol} is already in your watchlist'},
                status=status.HTTP_200_OK
            )

        return Response(
            {'message': f'{symbol} added to watchlist successfully'},
            status=status.HTTP_201_CREATED
        )

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_from_watchlist(request, symbol):
    """Remove a stock from user's watchlist"""
    try:
        from .models import Watchlist
        watchlist_item = Watchlist.objects.get(
            user=request.user,
            stock__symbol=symbol.upper()
        )
        watchlist_item.delete()
        return Response({'message': f'{symbol} removed from watchlist'})

    except Watchlist.DoesNotExist:
        return Response(
            {'error': 'Stock not in watchlist'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
