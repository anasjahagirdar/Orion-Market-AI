from django.db import models
from stocks.models import Stock
from news.models import NewsArticle

class SentimentResult(models.Model):
    """Sentiment analysis results for stocks"""
    SENTIMENT_CHOICES = [
        ('positive', 'Positive'),
        ('negative', 'Negative'),
        ('neutral', 'Neutral'),
    ]

    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name='sentiments')
    news_article = models.ForeignKey(NewsArticle, on_delete=models.CASCADE,
                                      related_name='sentiments', blank=True, null=True)
    sentiment_label = models.CharField(max_length=10, choices=SENTIMENT_CHOICES)
    sentiment_score = models.FloatField(help_text="Score from -1 (negative) to +1 (positive)")
    raw_text = models.TextField(blank=True, null=True)
    model_used = models.CharField(max_length=100, default='ProsusAI/finbert')
    analyzed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.stock.symbol} - {self.sentiment_label} ({self.sentiment_score:.2f})"

    class Meta:
        verbose_name = "Sentiment Result"
        verbose_name_plural = "Sentiment Results"
        ordering = ['-analyzed_at']

class StockSentimentSummary(models.Model):
    """Aggregated daily sentiment summary per stock"""
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name='sentiment_summaries')
    date = models.DateField()
    avg_score = models.FloatField()
    positive_count = models.IntegerField(default=0)
    negative_count = models.IntegerField(default=0)
    neutral_count = models.IntegerField(default=0)
    total_articles = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.stock.symbol} - {self.date} - Avg: {self.avg_score:.2f}"

    class Meta:
        verbose_name = "Sentiment Summary"
        verbose_name_plural = "Sentiment Summaries"
        unique_together = ['stock', 'date']
        ordering = ['-date']