from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('authentication.urls')),
    path('api/stocks/', include('stocks.urls')),
    path('api/news/', include('news.urls')),
    path('api/sentiment/', include('sentiment.urls')),
    path('api/chatbot/', include('chatbot.urls')),
    path('api/portfolios/', include('portfolio.urls')),
    path('api/portfolio/', include('portfolio.urls')),
]