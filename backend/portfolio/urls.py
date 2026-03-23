from django.urls import path
from . import views

urlpatterns = [
    path('', views.get_all_portfolios, name='get_all_portfolios'),
    path('stats/', views.get_portfolio_overview, name='get_portfolio_overview'),
    path('refresh/', views.refresh_portfolio, name='refresh_portfolio'),
    path('<str:country>/', views.get_country_portfolio, name='get_country_portfolio'),
]