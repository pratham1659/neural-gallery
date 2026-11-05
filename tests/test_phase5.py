import json
import socket
import tempfile
import threading
import time
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from PIL import Image

from neural_gallery.db import connect
from neural_gallery.review import make_handler
from neural_gallery.sync import SyncEngine, get_sync_engine


class TestPhase5P2PSync(unittest.TestCase):
    """Test suite for Phase 5: Air-Gapped Peer-to-Peer Wi-Fi Ingestion Engine."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test_sync.sqlite"
        self.test_incoming = Path(self.temp_dir.name) / "test_imports"
        self.test_incoming.mkdir(parents=True, exist_ok=True)
        import os
        os.environ["NEURAL_GALLERY_INCOMING_DIR"] = str(self.test_incoming)
        connection = connect(self.db_path)
        connection.close()

        self.engine = SyncEngine(vault_id="test-vault-uuid-1234")
        self.server, self.port = self._start_server()

    def tearDown(self):
        import os
        os.environ.pop("NEURAL_GALLERY_INCOMING_DIR", None)
        self.server.shutdown()
        self.server.server_close()
        self.temp_dir.cleanup()

    def _start_server(self):
        handler_class = make_handler(self.db_path)
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            port = s.getsockname()[1]
        server = ThreadingHTTPServer(("127.0.0.1", port), handler_class)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        time.sleep(0.05)
        return server, port

    def _request(self, method: str, path: str, body: bytes | None = None, headers: dict | None = None):
        conn = HTTPConnection("127.0.0.1", self.port)
        hdrs = headers or {}
        conn.request(method, path, body=body, headers=hdrs)
        resp = conn.getresponse()
        data = resp.read()
        conn.close()
        return resp.status, data

    def test_sync_engine_sas_pin_verification(self):
        """Test SAS PIN derivation, matching, and rotation."""
        pin = self.engine.sas_pin
        self.assertTrue(self.engine.verify_pin(pin))
        self.assertTrue(self.engine.verify_pin(pin.replace(" ", "")))
        self.assertFalse(self.engine.verify_pin("000000"))
        self.assertFalse(self.engine.verify_pin("99999"))

        new_pin = self.engine.generate_new_sas_pin()
        self.assertTrue(self.engine.verify_pin(new_pin))

    def test_sync_engine_device_pairing(self):
        """Test pairing a new device into the mesh."""
        pin = self.engine.sas_pin
        res = self.engine.pair_device("dev-pixel-fold", pin, "Pixel Fold", "Google Pixel")
        self.assertTrue(res["success"])
        self.assertTrue(res["paired"])
        self.assertEqual(res["device"]["name"], "Pixel Fold")

        # Unpairing
        self.assertTrue(self.engine.unpair_device("dev-pixel-fold"))

    def test_sync_engine_ingest_bytes(self):
        """Test ingesting photo bytes directly into incoming folder and SQLite library."""
        img = Image.new("RGB", (200, 200), color=(80, 140, 220))
        buf = BytesIO()
        img.save(buf, format="JPEG")
        data = buf.getvalue()

        incoming = Path(self.temp_dir.name) / "incoming"
        res = self.engine.ingest_bytes("mobile_upload.jpg", data, incoming, self.db_path)

        self.assertTrue(res["success"])
        self.assertIsNotNone(res["file_id"])
        self.assertTrue(Path(res["path"]).exists())

    def test_http_pwa_endpoint(self):
        """Test GET /sync returns the lightweight mobile upload PWA."""
        status, data = self._request("GET", "/sync")
        self.assertEqual(status, 200)
        self.assertIn(b"Neural Gallery", data)
        self.assertIn(b"Enter SAS Pairing PIN", data)

    def test_http_sync_status_endpoint(self):
        """Test GET /api/sync/status returns mesh state."""
        status, data = self._request("GET", "/api/sync/status")
        self.assertEqual(status, 200)
        payload = json.loads(data.decode())
        self.assertEqual(payload["status"], "ready")
        self.assertEqual(payload["service_name"], "_photovault._tcp.local.")
        self.assertTrue(payload["mesh_active"])
        self.assertIn("sas_pin", payload)
        self.assertIsInstance(payload["devices"], list)

    def test_http_sync_pair_endpoint(self):
        """Test POST /api/sync/pair with valid and invalid PIN."""
        current_pin = get_sync_engine().sas_pin

        # Valid PIN
        status, data = self._request(
            "POST",
            "/api/sync/pair",
            body=json.dumps({"pin": current_pin, "name": "Test iPhone", "device_id": "test-dev-1"}).encode(),
            headers={"Content-Type": "application/json"},
        )
        self.assertEqual(status, 200)
        payload = json.loads(data.decode())
        self.assertTrue(payload.get("success") or payload.get("paired"))

        # Invalid PIN
        status, data = self._request(
            "POST",
            "/api/sync/pair",
            body=json.dumps({"pin": "000000", "device_id": "bad-dev"}).encode(),
            headers={"Content-Type": "application/json"},
        )
        self.assertEqual(status, 401)

    def test_http_sync_upload_binary(self):
        """Test POST /api/sync/upload receives and indexes photo file."""
        img = Image.new("RGB", (100, 100), color=(255, 100, 50))
        buf = BytesIO()
        img.save(buf, format="JPEG")
        data = buf.getvalue()

        status, resp_data = self._request(
            "POST",
            "/api/sync/upload",
            body=data,
            headers={
                "Content-Type": "image/jpeg",
                "X-Filename": "phone_snapshot.jpg",
            },
        )
        self.assertEqual(status, 200)
        payload = json.loads(resp_data.decode())
        self.assertTrue(payload["success"])
        self.assertIsNotNone(payload["file_id"])


if __name__ == "__main__":
    unittest.main()
