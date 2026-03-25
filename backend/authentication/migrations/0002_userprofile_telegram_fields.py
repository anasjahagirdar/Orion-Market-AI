from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='telegram_chat_id',
            field=models.CharField(blank=True, db_index=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='telegram_username',
            field=models.CharField(blank=True, db_index=True, max_length=64, null=True),
        ),
    ]
