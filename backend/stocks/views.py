import time
import yfinance as yf
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import Stock, StockPrice
import logging

logger = logging.getLogger(__name__)


def get_ticker_with_retry(symbol, retries=3):
    """Get ticker data with retry on failure"""
    for attempt in range(retries):
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            if info and len(info) > 5:
                return ticker, info
            time.sleep(1)
        except Exception as e:
            logger.warning(f"Attempt {attempt+1} failed for {symbol}: {e}")
            time.sleep(2)
    return None, None


@api_view(['GET'])
@permission_classes([AllowAny])
def get_stocks(request):
    """Get list of all tracked stocks"""
    try:
        market = request.query_params.get('market', None)
        search = request.query_params.get('search', None)

        stocks = Stock.objects.filter(is_active=True)

        if market:
            stocks = stocks.filter(market=market.upper())

        if search:
            stocks = stocks.filter(symbol__icontains=search) | \
                     stocks.filter(name__icontains=search)

        stocks = stocks.values('id', 'symbol', 'name', 'market', 'sector')[:100]
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
    """Get current stock price using yfinance with retry"""
    try:
        ticker, info = get_ticker_with_retry(symbol.upper())

        if not info:
            # Fallback: use fast_info
            try:
                ticker = yf.Ticker(symbol.upper())
                fast = ticker.fast_info
                return Response({
                    'symbol': symbol.upper(),
                    'current_price': round(fast.last_price, 2) if fast.last_price else None,
                    'previous_close': round(fast.previous_close, 2) if fast.previous_close else None,
                    'open': round(fast.open, 2) if fast.open else None,
                    'day_high': round(fast.day_high, 2) if fast.day_high else None,
                    'day_low': round(fast.day_low, 2) if fast.day_low else None,
                    'volume': fast.three_month_average_volume,
                    'market_cap': fast.market_cap,
                    'name': symbol.upper(),
                })
            except Exception as e2:
                return Response(
                    {'error': f'Could not fetch price for {symbol}'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )

        price_data = {
            'symbol': symbol.upper(),
            'current_price': info.get('currentPrice') or info.get('regularMarketPrice'),
            'previous_close': info.get('previousClose'),
            'open': info.get('open'),
            'day_high': info.get('dayHigh'),
            'day_low': info.get('dayLow'),
            'volume': info.get('volume'),
            'market_cap': info.get('marketCap'),
            'name': info.get('longName') or info.get('shortName'),
        }
        return Response(price_data)

    except Exception as e:
        logger.error(f"get_stock_price error for {symbol}: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_stock_history(request, symbol):
    """Get historical price data using yfinance"""
    try:
        period = request.query_params.get('period', '1mo')
        interval = request.query_params.get('interval', '1d')

        ticker = yf.Ticker(symbol.upper())
        hist = ticker.history(period=period, interval=interval)

        if hist.empty:
            return Response(
                {'error': f'No historical data found for {symbol}'},
                status=status.HTTP_404_NOT_FOUND
            )

        history = []
        for date, row in hist.iterrows():
            history.append({
                'date': str(date.date()),
                'open': round(float(row['Open']), 2),
                'high': round(float(row['High']), 2),
                'low': round(float(row['Low']), 2),
                'close': round(float(row['Close']), 2),
                'volume': int(row['Volume']),
            })

        return Response({'symbol': symbol.upper(), 'history': history})

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