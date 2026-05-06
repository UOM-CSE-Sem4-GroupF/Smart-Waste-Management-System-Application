import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
KONG_PATH = ROOT / "kong" / "kong.yml"


def _read_non_comment_text() -> str:
    text = KONG_PATH.read_text(encoding="utf-8")
    lines = [line for line in text.splitlines() if not line.lstrip().startswith("#")]
    return "\n".join(lines)


class TestKongConfig(unittest.TestCase):
    def test_format_version_is_3(self) -> None:
        text = _read_non_comment_text()
        self.assertIn('_format_version: "3.0"', text)

    def test_no_internal_paths_exposed(self) -> None:
        text = _read_non_comment_text()
        self.assertNotIn("/internal", text)

    def test_expected_routes_present(self) -> None:
        text = _read_non_comment_text()
        for path in (
            "/api/v1/bins",
            "/api/v1/collection-jobs",
            "/api/v1/drivers/available",
        ):
            self.assertIn(path, text)

    def test_basic_gateway_plugins_present(self) -> None:
        text = _read_non_comment_text()
        self.assertIn("name: cors", text)
        self.assertIn("name: rate-limiting", text)
