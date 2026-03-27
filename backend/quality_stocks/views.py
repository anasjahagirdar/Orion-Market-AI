from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import QualityStock
from .serializers import QualityStockDetailSerializer, QualityStockListSerializer
from .services.report_generator import generate_report
from .services.stock_selector import select_quality_stocks


class QualityStocksListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        stocks = QualityStock.objects.filter(is_active=True).select_related('financials', 'ai_report')

        sector_map = {}
        for stock in stocks:
            sector_map.setdefault(stock.sector, []).append(stock)

        sectors_data = [
            {
                'sector': sector,
                'stocks': QualityStockListSerializer(stock_list, many=True).data,
            }
            for sector, stock_list in sorted(sector_map.items())
        ]

        last_updated = stocks.order_by('-last_updated').first()
        return Response(
            {
                'sectors': sectors_data,
                'total_stocks': stocks.count(),
                'last_updated': last_updated.last_updated if last_updated else None,
            }
        )


class SectorsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sectors = (
            QualityStock.objects.filter(is_active=True)
            .values_list('sector', flat=True)
            .distinct()
            .order_by('sector')
        )
        return Response({'sectors': list(sectors)})


class QualityStockDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, ticker):
        stock = get_object_or_404(
            QualityStock.objects.select_related('financials', 'ai_report'),
            ticker=ticker.upper(),
            is_active=True,
        )
        return Response(QualityStockDetailSerializer(stock).data)


class RefreshQualityStocksView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.user.is_staff:
            return Response({'error': 'Admin access required.'}, status=403)

        try:
            select_quality_stocks()
            for stock in QualityStock.objects.filter(is_active=True):
                generate_report(stock)
            return Response({'status': 'success', 'message': 'Quality stocks refreshed.'})
        except Exception as exc:
            return Response({'status': 'error', 'message': str(exc)}, status=500)
