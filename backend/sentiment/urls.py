from django.urls import path
from . import views

urlpatterns = [
    path('analyze/', views.analyze_sentiment, name='analyze_sentiment'),
    path('<str:symbol>/', views.get_stock_sentiment, name='get_stock_sentiment'),
    path('<str:symbol>/summary/', views.get_sentiment_summary, name='get_sentiment_summary'),
]