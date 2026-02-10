from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_comment_position_from_comment_position_to_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='node',
            name='summary',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='node',
            name='summary_updated_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
