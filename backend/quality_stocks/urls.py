from django.urls import path

from .views import (
    QualityStockDetailView,
    QualityStocksListView,
    RefreshQualityStocksView,
    SectorsListView,
)

urlpatterns = [
    path('', QualityStocksListView.as_view(), name='quality-stocks-list'),
    path('sectors/', SectorsListView.as_view(), name='quality-stocks-sectors'),
    path('refresh/', RefreshQualityStocksView.as_view(), name='quality-stocks-refresh'),
    path('<str:ticker>/', QualityStockDetailView.as_view(), name='quality-stock-detail'),
]
