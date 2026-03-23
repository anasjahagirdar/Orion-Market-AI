from django.db import models

class Stock(models.Model):
    """Represents a stock/crypto asset"""
    MARKET_CHOICES = [
        ('IN', 'Indian'),
        ('US', 'US'),
        ('CRYPTO', 'Cryptocurrency'),
    ]

    symbol = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=200)
    market = models.CharField(max_length=10, choices=MARKET_CHOICES, default='US')
    sector = models.CharField(max_length=100, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.symbol} - {self.name}"

    class Meta:
        verbose_name = "Stock"
        verbose_name_plural = "Stocks"

class StockPrice(models.Model):
    """Historical and current stock price data"""
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name='prices')
    open_price = models.FloatField()
    high_price = models.FloatField()
    low_price = models.FloatField()
    close_price = models.FloatField()
    volume = models.BigIntegerField()
    timestamp = models.DateTimeField()
    source = models.CharField(max_length=50, default='yfinance')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.stock.symbol} - {self.timestamp}"

    class Meta:
        verbose_name = "Stock Price"
        verbose_name_plural = "Stock Prices"
        ordering = ['-timestamp']
class Watchlist(models.Model):
    """User's personal stock watchlist"""
    user = models.ForeignKey(
        'auth.User',
        on_delete=models.CASCADE,
        related_name='watchlist'
    )
    stock = models.ForeignKey(
        Stock,
        on_delete=models.CASCADE,
        related_name='watchlisted_by'
    )
    added_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ['user', 'stock']
        ordering = ['-added_at']

    def __str__(self):
        return f"{self.user.username} → {self.stock.symbol}"