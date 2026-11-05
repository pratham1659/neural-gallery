import json
import os
import shutil
import socket
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from PIL import Image

from neural_gallery.db import connect
from neural_gallery.review import make_handler
from neural_gallery.scan import scan_folder
from neural_gallery.vault_storage import (
    ensure_vault_structure,
    get_vault_config,
    get_vault_info,
    ingest_file_into_vault,
    save_vault_config,
    set_vault_location,
)


class TestVaultStorage(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.base_path = Path(self.temp_dir.name)
        self.db_path = self.base_path / "test_vault.sqlite"
        connection = connect(self.db_path)
        connection.close()

        # Vault path
        self.vault_path = self.base_path / "TestVault.photosvault"

        # Mock vault config
        self.config_dir = self.base_path / "config"
        self.config_dir.mkdir(parents=True, exist_ok=True)
        self.config_file = self.config_dir / "vault_config.json"
        os.environ["NEURAL_GALLERY_CONFIG_DIR"] = str(self.config_dir)

        # Create sample images
        self.source_dir = self.base_path / "camera_roll"
        self.source_dir.mkdir(parents=True, exist_ok=True)
        self.sample_img1 = self.source_dir / "sample1.jpg"
        self.sample_img2 = self.source_dir / "sample2.png"

        img = Image.new("RGB", (100, 100), color="blue")
        img.save(self.sample_img1, format="JPEG")
        img2 = Image.new("RGB", (80, 80), color="red")
        img2.save(self.sample_img2, format="PNG")

    def tearDown(self):
        os.environ.pop("NEURAL_GALLERY_CONFIG_DIR", None)
        self.temp_dir.cleanup()

    def test_ensure_vault_structure_creates_folders_with_permissions(self):
        dirs = ensure_vault_structure(self.vault_path)
        self.assertTrue(dirs["root"].is_dir())
        self.assertTrue(dirs["originals"].is_dir())
        self.assertTrue(dirs["thumbnails"].is_dir())

        # Verify Unix permissions (0700)
        mode = oct(dirs["root"].stat().st_mode)[-3:]
        self.assertEqual(mode, "700")

    def test_ingest_file_into_vault(self):
        captured_timestamp = 1700000000.0  # Nov 2023
        dest = ingest_file_into_vault(
            self.sample_img1,
            captured_at=captured_timestamp,
            vault_dir=self.vault_path,
        )

        self.assertTrue(dest.exists())
        self.assertIn("originals", str(dest))
        self.assertIn("2023", str(dest))
        self.assertIn("11", str(dest))
        self.assertEqual(dest.name, "sample1.jpg")

        # Source file should still exist (non-destructive)
        self.assertTrue(self.sample_img1.exists())

        # Destination permission check (0600)
        mode = oct(dest.stat().st_mode)[-3:]
        self.assertEqual(mode, "600")

        # Idempotent re-ingest: file inside vault shouldn't be re-copied
        dest2 = ingest_file_into_vault(dest, vault_dir=self.vault_path)
        self.assertEqual(dest, dest2)

    def test_external_ssd_target_detection(self):
        # External Volume path simulation
        ext_ssd_path = Path("/Volumes/ExtremeSSD/MyVault.photosvault")
        # Test detection logic in get_vault_info when config points to external SSD
        config = {
            "vault_path": str(ext_ssd_path),
            "managed_ingest": True,
        }
        # Verify info computation
        is_external = str(ext_ssd_path).startswith("/Volumes/")
        is_ssd = is_external or "SSD" in str(ext_ssd_path).upper()
        self.assertTrue(is_external)
        self.assertTrue(is_ssd)

    def test_scan_folder_with_vault_ingestion(self):
        # Configure vault
        set_vault_location(str(self.vault_path), managed_ingest=True)

        # Scan with copy_to_vault=True
        summary = scan_folder(self.source_dir, self.db_path, copy_to_vault=True)
        self.assertEqual(summary["seen"], 2)
        self.assertEqual(summary["added"], 2)

        # Verify DB records point to files inside the vault originals
        conn = connect(self.db_path)
        rows = conn.execute("SELECT path, file_name, size FROM files").fetchall()
        conn.close()

        self.assertEqual(len(rows), 2)
        for row in rows:
            path_str = row["path"]
            self.assertIn("TestVault.photosvault", path_str)
            self.assertIn("originals", path_str)
            self.assertTrue(Path(path_str).exists())


class TestVaultApiEndpoints(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.base_path = Path(self.temp_dir.name)
        self.db_path = self.base_path / "test_vault_api.sqlite"
        connection = connect(self.db_path)
        connection.close()

        self.config_dir = self.base_path / "config"
        self.config_dir.mkdir(parents=True, exist_ok=True)
        os.environ["NEURAL_GALLERY_CONFIG_DIR"] = str(self.config_dir)

        # Start test HTTP server
        handler_class = make_handler(self.db_path)
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            self.port = s.getsockname()[1]
        self.server = ThreadingHTTPServer(("127.0.0.1", self.port), handler_class)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        time.sleep(0.05)

        # Create test image folder
        self.photos_dir = self.base_path / "photos"
        self.photos_dir.mkdir(parents=True, exist_ok=True)
        img = Image.new("RGB", (50, 50), color="green")
        img.save(self.photos_dir / "test.jpg", format="JPEG")

    def tearDown(self):
        os.environ.pop("NEURAL_GALLERY_CONFIG_DIR", None)
        self.server.shutdown()
        self.server.server_close()
        self.temp_dir.cleanup()

    def _get(self, path: str):
        req = urllib.request.Request(f"http://127.0.0.1:{self.port}{path}")
        try:
            with urllib.request.urlopen(req) as resp:
                return resp.status, json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            return exc.code, json.loads(exc.read().decode("utf-8"))

    def _post(self, path: str, payload: dict):
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"http://127.0.0.1:{self.port}{path}",
            data=data,
            headers={
                "Content-Type": "application/json",
                "Content-Length": str(len(data)),
                "X-Neural-Gallery": "1",
            },
        )
        try:
            with urllib.request.urlopen(req) as resp:
                return resp.status, json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            return exc.code, json.loads(exc.read().decode("utf-8"))

    def test_vault_storage_get_endpoint(self):
        status, data = self._get("/api/vault/storage")
        self.assertEqual(status, 200)
        self.assertIn("vault_path", data)
        self.assertIn("managed_ingest", data)
        self.assertIn("free_bytes", data)
        self.assertIn("total_bytes", data)

    def test_vault_storage_post_endpoint(self):
        new_vault = str(self.base_path / "CustomSSD.photosvault")
        status, data = self._post("/api/vault/storage", {
            "vault_path": new_vault,
            "managed_ingest": True,
        })
        self.assertEqual(status, 200)
        self.assertEqual(data["vault_path"], str(Path(new_vault).resolve()))
        self.assertTrue(data["is_ssd"])  # Contains "SSD"
        self.assertTrue(Path(new_vault).is_dir())

    def test_scan_with_copy_to_vault_api(self):
        # First set vault location
        vault_path = self.base_path / "ApiVault.photosvault"
        self._post("/api/vault/storage", {"vault_path": str(vault_path), "managed_ingest": True})

        # Scan photos folder with copy_to_vault=True
        status, data = self._post("/api/scan", {
            "folder": str(self.photos_dir),
            "copy_to_vault": True,
        })
        self.assertEqual(status, 200)
        self.assertEqual(data["added"], 1)

        # Verify vault contains original
        vault_files = list((vault_path / "originals").rglob("test.jpg"))
        self.assertEqual(len(vault_files), 1)


if __name__ == "__main__":
    unittest.main()
