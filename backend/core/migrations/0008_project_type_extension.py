from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0007_project_node_context_nodes'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='project_type',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
        migrations.AddField(
            model_name='project',
            name='project_extension',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
    ]
