from django.urls import path

from .views import get_sector_portfolio

urlpatterns = [
    path('<str:sector>/', get_sector_portfolio, name='get_sector_portfolio'),
]
