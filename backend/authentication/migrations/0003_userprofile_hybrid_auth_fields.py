from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0002_userprofile_telegram_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='auth_type',
            field=models.CharField(
                choices=[('username', 'Username'), ('telegram', 'Telegram')],
                db_index=True,
                default='username',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='security_answers',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='security_questions',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='telegram_phone',
            field=models.CharField(blank=True, db_index=True, max_length=20, null=True),
        ),
    ]
