from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0011_comment_review_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="published_snapshot",
            field=models.JSONField(blank=True, default=None, null=True),
        ),
        migrations.AddField(
            model_name="project",
            name="published_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
