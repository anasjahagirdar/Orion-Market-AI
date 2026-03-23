from django.urls import path
from . import views

urlpatterns = [
    path('', views.get_stocks, name='get_stocks'),
    path('watchlist/', views.get_watchlist, name='get_watchlist'),
    path('watchlist/add/', views.add_to_watchlist, name='add_to_watchlist'),
    path('watchlist/remove/<str:symbol>/', views.remove_from_watchlist, name='remove_from_watchlist'),
    path('<str:symbol>/', views.get_stock_detail, name='get_stock_detail'),
    path('<str:symbol>/price/', views.get_stock_price, name='get_stock_price'),
    path('<str:symbol>/history/', views.get_stock_history, name='get_stock_history'),
]