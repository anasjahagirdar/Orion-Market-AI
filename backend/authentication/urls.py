from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('login/', views.login_view, name='login'),
    path(
        'debug/reset-otp-rate-limit/',
        views.debug_reset_otp_rate_limit,
        name='debug_reset_otp_rate_limit',
    ),
    path('sync-telegram-chat/', views.sync_telegram_chat, name='sync_telegram_chat'),
    path('send-telegram-otp/', views.send_telegram_otp, name='send_telegram_otp'),
    path('verify-telegram-otp/', views.verify_telegram_otp, name='verify_telegram_otp'),
    path('security-questions/', views.get_security_questions, name='get_security_questions'),
    path('verify-security-answers/', views.verify_security_answers, name='verify_security_answers'),
    path('reset-password/', views.reset_password, name='reset_password'),
    path('logout/', views.logout_view, name='logout'),
    path('profile/', views.profile, name='profile'),
]
