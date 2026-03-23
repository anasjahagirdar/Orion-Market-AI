from django.urls import path
from . import views

urlpatterns = [
    path('chat/', views.chat, name='chat'),
    path('sessions/', views.get_sessions, name='get_sessions'),
    path('sessions/<int:session_id>/', views.get_session_messages, name='get_session_messages'),
    path('sessions/<int:session_id>/delete/', views.delete_session, name='delete_session'),
]