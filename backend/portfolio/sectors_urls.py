from django.urls import path

from .sectors_views import get_market_sectors

urlpatterns = [
    path('<str:market>/', get_market_sectors, name='get_market_sectors'),
]
