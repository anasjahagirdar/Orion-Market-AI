from django.urls import path

from .views import btc_analysis_data

urlpatterns = [
    path("", btc_analysis_data, name="btc_analysis_data"),
]

