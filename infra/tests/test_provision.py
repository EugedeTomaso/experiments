import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest import mock


MODULE_PATH = Path(__file__).resolve().parents[1] / "provision.py"


def load_provision_module():
    fake_fernet = type(
        "FakeFernet",
        (),
        {"generate_key": staticmethod(lambda: b"generated-fernet-key")},
    )

    modules = {
        "cryptography": types.ModuleType("cryptography"),
        "cryptography.fernet": types.ModuleType("cryptography.fernet"),
        "hcloud": types.ModuleType("hcloud"),
        "hcloud.firewalls": types.ModuleType("hcloud.firewalls"),
        "hcloud.firewalls.domain": types.ModuleType("hcloud.firewalls.domain"),
        "hcloud.images": types.ModuleType("hcloud.images"),
        "hcloud.locations": types.ModuleType("hcloud.locations"),
        "hcloud.server_types": types.ModuleType("hcloud.server_types"),
    }
    modules["cryptography.fernet"].Fernet = fake_fernet
    modules["hcloud"].Client = object
    modules["hcloud.firewalls.domain"].FirewallRule = object
    modules["hcloud.images"].Image = object
    modules["hcloud.locations"].Location = object
    modules["hcloud.server_types"].ServerType = object

    with mock.patch.dict(sys.modules, modules):
        spec = importlib.util.spec_from_file_location("provision_under_test", MODULE_PATH)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module


class ProvisionDefaultsTests(unittest.TestCase):
    def test_defaults_target_cx23_and_development_ref(self):
        module = load_provision_module()

        self.assertEqual(module.SERVER_TYPE, "cx23")
        self.assertEqual(module.DEPLOY_REF, "development")

    def test_cloud_init_uses_https_clone_for_repo_bootstrap(self):
        module = load_provision_module()
        module.GITHUB_REPO = "https://github.com/EugedeTomaso/experiments.git"

        cloud_init = module.build_cloud_init(
            {
                "django_secret": "django-secret",
                "encryption_key": "encryption-key",
                "db_password": "db-password",
                "internal_api_key": "internal-api-key",
            }
        )

        self.assertIn(
            "git clone https://github.com/EugedeTomaso/experiments.git /opt/mive",
            cloud_init,
        )
        self.assertIn("git -C /opt/mive checkout development", cloud_init)
        self.assertNotIn("/root/.ssh/deploy_key", cloud_init)

    def test_cloud_init_writes_ip_based_runtime_env(self):
        module = load_provision_module()

        cloud_init = module.build_cloud_init(
            {
                "django_secret": "django-secret",
                "encryption_key": "encryption-key",
                "db_password": "db-password",
                "internal_api_key": "internal-api-key",
            }
        )

        self.assertIn("DJANGO_ALLOWED_HOSTS=$SERVER_IP", cloud_init)
        self.assertIn("CSRF_TRUSTED_ORIGINS=http://$SERVER_IP", cloud_init)
        self.assertIn("VITE_API_BASE=http://$SERVER_IP", cloud_init)
        self.assertIn("VITE_COLLAB_URL=ws://$SERVER_IP/ws", cloud_init)


if __name__ == "__main__":
    unittest.main()
