from django.db import models
from stocks.models import Stock

class NewsArticle(models.Model):
    """News articles related to stocks"""
    SOURCE_CHOICES = [
        ('newsapi', 'NewsAPI'),
        ('finnhub', 'Finnhub'),
        ('scraped', 'Scraped'),
    ]

    title = models.CharField(max_length=500)
    content = models.TextField(blank=True, null=True)
    summary = models.TextField(blank=True, null=True)
    url = models.URLField(max_length=1000, unique=True)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='newsapi')
    source_name = models.CharField(max_length=200, blank=True, null=True)
    related_stocks = models.ManyToManyField(Stock, blank=True, related_name='news')
    published_at = models.DateTimeField()
    fetched_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title[:100]

    class Meta:
        verbose_name = "News Article"
        verbose_name_plural = "News Articles"
        ordering = ['-published_at']