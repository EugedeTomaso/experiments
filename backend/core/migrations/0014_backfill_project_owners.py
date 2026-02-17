from django.db import migrations


def backfill_owners(apps, schema_editor):
    """Assign the first superuser (or first user) as owner of all ownerless projects."""
    User = apps.get_model("auth", "User")
    Project = apps.get_model("core", "Project")

    ownerless = Project.objects.filter(owner__isnull=True)
    if not ownerless.exists():
        return

    default_owner = (
        User.objects.filter(is_superuser=True).order_by("id").first()
        or User.objects.order_by("id").first()
    )
    if default_owner:
        ownerless.update(owner=default_owner)


def reverse(apps, schema_editor):
    pass  # no-op reverse


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0013_projectmembership"),
    ]

    operations = [
        migrations.RunPython(backfill_owners, reverse),
    ]
