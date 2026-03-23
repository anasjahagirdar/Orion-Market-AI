from django.db import models
from django.contrib.auth.models import User

class UserProfile(models.Model):
    """Extended user profile for Orion Market AI"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - Profile"

    class Meta:
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"