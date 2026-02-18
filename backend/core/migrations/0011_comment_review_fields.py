import django.db.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0010_memory'),
    ]

    operations = [
        migrations.AddField(
            model_name='comment',
            name='parent',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
                related_name='replies', to='core.comment',
            ),
        ),
        migrations.AddField(
            model_name='comment',
            name='author_type',
            field=models.CharField(
                choices=[('user', 'User'), ('assistant', 'Assistant')],
                default='user', max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='comment',
            name='status',
            field=models.CharField(
                choices=[
                    ('open', 'Open'), ('approved', 'Approved'),
                    ('rejected', 'Rejected'), ('resolved', 'Resolved'),
                ],
                default='open', max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='comment',
            name='suggested_text',
            field=models.TextField(blank=True, default=''),
        ),
    ]
