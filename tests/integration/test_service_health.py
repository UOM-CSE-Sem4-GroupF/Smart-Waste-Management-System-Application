import json
import os
import unittest
import urllib.error
import urllib.request


def _request(url: str) -> tuple[int, str]:
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            return resp.status, resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8")


class TestServiceHealth(unittest.TestCase):
    def _require(self, env_name: str) -> str:
        url = os.getenv(env_name)
        if not url:
            self.skipTest(f"{env_name} not set")
        return url.rstrip("/")

    def _assert_health(self, base_url: str) -> None:
        status, body = _request(f"{base_url}/health")
        self.assertEqual(status, 200)
        payload = json.loads(body)
        self.assertIn("status", payload)

    def test_orchestrator_health(self) -> None:
        self._assert_health(self._require("ORCHESTRATOR_URL"))

    def test_bin_status_health(self) -> None:
        self._assert_health(self._require("BIN_STATUS_URL"))

    def test_scheduler_health(self) -> None:
        self._assert_health(self._require("SCHEDULER_URL"))

    def test_notification_health(self) -> None:
        self._assert_health(self._require("NOTIFICATION_URL"))

    def test_kong_public_routes(self) -> None:
        kong_url = os.getenv("KONG_URL")
        if not kong_url:
            self.skipTest("KONG_URL not set")
        kong_url = kong_url.rstrip("/")

        for path in ("/api/v1/bins", "/api/v1/collection-jobs"):
            status, _body = _request(f"{kong_url}{path}")
            self.assertNotIn(status, {404, 502, 503})
