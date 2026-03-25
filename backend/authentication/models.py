from django.db import models
from django.contrib.auth.models import User


class UserProfile(models.Model):
    """Extended user profile for Orion Market AI"""
    AUTH_TYPE_USERNAME = 'username'
    AUTH_TYPE_TELEGRAM = 'telegram'
    AUTH_TYPE_CHOICES = [
        (AUTH_TYPE_USERNAME, 'Username'),
        (AUTH_TYPE_TELEGRAM, 'Telegram'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    telegram_username = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    telegram_phone = models.CharField(max_length=20, blank=True, null=True, db_index=True)
    telegram_chat_id = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    auth_type = models.CharField(
        max_length=20,
        choices=AUTH_TYPE_CHOICES,
        default=AUTH_TYPE_USERNAME,
        db_index=True,
    )
    security_questions = models.JSONField(default=list, blank=True)
    security_answers = models.JSONField(default=list, blank=True)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - Profile"

    class Meta:
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"
