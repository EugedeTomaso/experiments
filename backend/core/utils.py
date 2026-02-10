import os

from cryptography.fernet import Fernet
from django.core.exceptions import ImproperlyConfigured

HARDCODED_PROVIDER_KEYS = {
    "openrouter": "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",
}


def _get_fernet() -> Fernet:
    key = os.environ.get("ENCRYPTION_KEY")
    if not key:
        raise ImproperlyConfigured("ENCRYPTION_KEY is required to encrypt API keys")
    return Fernet(key)


def encrypt_value(value: str) -> str:
    if value is None:
        return ""
    return _get_fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_value(value: str) -> str:
    if not value:
        return ""
    return _get_fernet().decrypt(value.encode("utf-8")).decode("utf-8")


def get_default_workspace():
    from .models import Workspace

    workspace, _ = Workspace.objects.get_or_create(
        id=1, defaults={"name": "Default Workspace"}
    )
    return workspace


def get_hardcoded_provider_key(provider: str) -> str:
    return HARDCODED_PROVIDER_KEYS.get(provider, "")


def ensure_hardcoded_provider_keys() -> None:
    from .models import ProviderKey

    if not HARDCODED_PROVIDER_KEYS:
        return

    for provider, key in HARDCODED_PROVIDER_KEYS.items():
        if not key:
            continue
        try:
            instance, _ = ProviderKey.objects.get_or_create(provider=provider)
            if not instance.api_key_encrypted:
                instance.set_api_key(key)
                instance.save(update_fields=["api_key_encrypted", "updated_at"])
        except ImproperlyConfigured:
            # If encryption isn't configured, skip auto-seeding.
            return
