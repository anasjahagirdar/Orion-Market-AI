from django.urls import path

from .views import get_market_sector_portfolio, get_sector_portfolio

urlpatterns = [
    path('<str:market>/<str:sector>/', get_market_sector_portfolio, name='get_market_sector_portfolio'),
    path('<str:sector>/', get_sector_portfolio, name='get_sector_portfolio'),
]
