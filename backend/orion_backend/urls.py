from django.contrib import admin
from django.urls import path, include
from portfolio import views as portfolio_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('authentication.urls')),
    path('api/stocks/', include('stocks.urls')),
    path('api/news/', include('news.urls')),
    path('api/sentiment/', include('sentiment.urls')),
    path('api/chatbot/', include('chatbot.urls')),
    path('api/portfolios/', include('portfolio.urls')),
    path('api/portfolio/', include('portfolio.sector_urls')),
    path('api/sectors/', include('portfolio.sectors_urls')),
    path('api/recompute-portfolio/<str:market>/', portfolio_views.recompute_portfolio_market),
    path('api/recompute-portfolio/', portfolio_views.recompute_portfolio),
    path('api/btc-analysis/', include('btc_analysis.urls')),
    path('api/quality-stocks/', include('quality_stocks.urls')),
]
