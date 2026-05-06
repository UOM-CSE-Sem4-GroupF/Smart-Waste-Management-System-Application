import os
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

os.environ.setdefault("KAFKA_BROKER", "localhost:9092")

if "requests" not in sys.modules:
    sys.modules["requests"] = types.SimpleNamespace(post=lambda *args, **kwargs: None)

BRIDGE_DIR = Path(__file__).resolve().parent.parent
if str(BRIDGE_DIR) not in sys.path:
    sys.path.insert(0, str(BRIDGE_DIR))

import bridge


class TestMakeConsumer(unittest.TestCase):
    def setUp(self) -> None:
        self._orig_user = bridge.USER
        self._orig_pass = bridge.PASS
        self._orig_topic = bridge.TOPIC
        self._orig_broker = bridge.BROKER

    def tearDown(self) -> None:
        bridge.USER = self._orig_user
        bridge.PASS = self._orig_pass
        bridge.TOPIC = self._orig_topic
        bridge.BROKER = self._orig_broker

    @patch("bridge.TopicPartition")
    @patch("bridge.KafkaConsumer")
    def test_make_consumer_assigns_partition(self, mock_consumer_cls, mock_tp_cls) -> None:
        consumer = MagicMock()
        mock_consumer_cls.return_value = consumer
        tp = MagicMock()
        mock_tp_cls.return_value = tp

        bridge.USER = "user"
        bridge.PASS = "pass"
        bridge.TOPIC = "waste.bin.telemetry"
        bridge.BROKER = "broker:9092"

        result = bridge.make_consumer()

        self.assertIs(result, consumer)
        mock_tp_cls.assert_called_once_with("waste.bin.telemetry", 0)
        consumer.assign.assert_called_once_with([tp])
        consumer.seek_to_end.assert_called_once_with(tp)

        kwargs = mock_consumer_cls.call_args.kwargs
        self.assertEqual(kwargs["bootstrap_servers"], ["broker:9092"])
        self.assertEqual(kwargs["security_protocol"], "SASL_PLAINTEXT")
        self.assertEqual(kwargs["sasl_mechanism"], "SCRAM-SHA-256")

    @patch("bridge.TopicPartition")
    @patch("bridge.KafkaConsumer")
    def test_make_consumer_without_sasl(self, mock_consumer_cls, _mock_tp_cls) -> None:
        mock_consumer_cls.return_value = MagicMock()
        bridge.USER = None
        bridge.PASS = None
        bridge.TOPIC = "waste.bin.telemetry"
        bridge.BROKER = "broker:9092"

        bridge.make_consumer()

        kwargs = mock_consumer_cls.call_args.kwargs
        self.assertNotIn("security_protocol", kwargs)
        self.assertNotIn("sasl_mechanism", kwargs)


class TestPost(unittest.TestCase):
    def test_post_handles_exceptions(self) -> None:
        with patch("bridge.requests.post", side_effect=Exception("boom")) as mock_post:
            bridge.post("http://example.local", {"hello": "world"})
            mock_post.assert_called_once()
