from rest_framework import serializers

from .models import QualityStock, StockAIReport, StockFinancialSnapshot


class StockFinancialSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockFinancialSnapshot
        exclude = ['id', 'stock']


class AIReportSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = StockAIReport
        fields = ['summary', 'sentiment_label', 'sentiment_score', 'recommendation', 'generated_at']


class AIReportFullSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockAIReport
        fields = '__all__'


class QualityStockListSerializer(serializers.ModelSerializer):
    financials = StockFinancialSnapshotSerializer(read_only=True)
    ai_report = AIReportSummarySerializer(read_only=True)

    class Meta:
        model = QualityStock
        fields = [
            'id', 'ticker', 'name', 'sector', 'market', 'exchange',
            'quality_score', 'rank_in_sector', 'last_updated',
            'financials', 'ai_report',
        ]


class QualityStockDetailSerializer(serializers.ModelSerializer):
    financials = StockFinancialSnapshotSerializer(read_only=True)
    ai_report = AIReportFullSerializer(read_only=True)

    class Meta:
        model = QualityStock
        fields = '__all__'
