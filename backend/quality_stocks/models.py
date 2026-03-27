from django.db import models


class QualityStock(models.Model):
    ticker = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=200)
    sector = models.CharField(max_length=100)
    market = models.CharField(max_length=10)
    exchange = models.CharField(max_length=20)
    quality_score = models.FloatField(default=0.0)
    rank_in_sector = models.IntegerField(default=1)
    is_active = models.BooleanField(default=True)
    last_updated = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['sector', 'rank_in_sector']

    def __str__(self):
        return f"{self.ticker} [{self.sector}] Rank {self.rank_in_sector}"


class StockFinancialSnapshot(models.Model):
    stock = models.OneToOneField(
        'QualityStock',
        on_delete=models.CASCADE,
        related_name='financials',
    )
    current_price = models.FloatField(null=True, blank=True)
    market_cap = models.BigIntegerField(null=True, blank=True)
    pe_ratio = models.FloatField(null=True, blank=True)
    pb_ratio = models.FloatField(null=True, blank=True)
    eps = models.FloatField(null=True, blank=True)
    revenue_growth_yoy = models.FloatField(null=True, blank=True)
    profit_margin = models.FloatField(null=True, blank=True)
    roe = models.FloatField(null=True, blank=True)
    debt_to_equity = models.FloatField(null=True, blank=True)
    dividend_yield = models.FloatField(null=True, blank=True)
    week_52_high = models.FloatField(null=True, blank=True)
    week_52_low = models.FloatField(null=True, blank=True)
    avg_volume = models.BigIntegerField(null=True, blank=True)
    beta = models.FloatField(null=True, blank=True)
    price_history_json = models.JSONField(default=list)
    fetched_at = models.DateTimeField(auto_now=True)


class StockAIReport(models.Model):
    stock = models.OneToOneField(
        'QualityStock',
        on_delete=models.CASCADE,
        related_name='ai_report',
    )
    summary = models.TextField()
    strengths = models.JSONField(default=list)
    risks = models.JSONField(default=list)
    full_report = models.TextField()
    sentiment_label = models.CharField(max_length=20)
    sentiment_score = models.FloatField(default=0.0)
    recommendation = models.CharField(max_length=20)
    generated_at = models.DateTimeField(auto_now=True)
    model_used = models.CharField(max_length=100, default='llama-3.1-8b-instant')
