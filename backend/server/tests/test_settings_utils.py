from django.test import SimpleTestCase

from server.settings_utils import build_allowed_hosts


class BuildAllowedHostsTests(SimpleTestCase):
    def test_appends_internal_service_hosts(self):
        self.assertEqual(
            build_allowed_hosts("178.104.39.241"),
            ["178.104.39.241", "backend", "localhost", "127.0.0.1"],
        )

    def test_strips_whitespace_and_deduplicates(self):
        self.assertEqual(
            build_allowed_hosts(" example.com, backend , example.com , "),
            ["example.com", "backend", "localhost", "127.0.0.1"],
        )
