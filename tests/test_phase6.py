import json
import socket
import subprocess
import tempfile
import threading
import time
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path

from neural_gallery.db import connect
from neural_gallery.review import make_handler

ROOT = Path(__file__).resolve().parent.parent


class TestPhase6ReactFrontend(unittest.TestCase):
    """Test suite for Phase 6: React 19 + TypeScript + Vite + TanStack Virtual frontend migration."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test_phase6.sqlite"
        connection = connect(self.db_path)
        connection.close()

        self.server, self.port = self._start_server()

    def tearDown(self):
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

    def _request(self, path: str):
        conn = HTTPConnection("127.0.0.1", self.port)
        conn.request("GET", path)
        resp = conn.getresponse()
        data = resp.read()
        headers = {k.lower(): v for k, v in resp.getheaders()}
        conn.close()
        return resp.status, data, headers

    def test_frontend_project_structure(self):
        """Verify frontend configuration and source files exist."""
        self.assertTrue((ROOT / "package.json").exists())
        self.assertTrue((ROOT / "tsconfig.json").exists())
        self.assertTrue((ROOT / "vite.config.ts").exists())
        self.assertTrue((ROOT / "tailwind.config.js").exists())
        self.assertTrue((ROOT / "index.html").exists())
        self.assertTrue((ROOT / "src" / "App.tsx").exists())
        self.assertTrue((ROOT / "src" / "main.tsx").exists())
        self.assertTrue((ROOT / "src" / "index.css").exists())
        self.assertTrue((ROOT / "src" / "types" / "gallery.ts").exists())
        self.assertTrue((ROOT / "src" / "services" / "api.ts").exists())

    def test_modular_react_components(self):
        """Verify all segmented views, modals, and navigation components exist."""
        comp_dir = ROOT / "src" / "components"
        self.assertTrue((comp_dir / "layout" / "Header.tsx").exists())
        self.assertTrue((comp_dir / "layout" / "Sidebar.tsx").exists())
        self.assertTrue((comp_dir / "timeline" / "TimelineView.tsx").exists())
        self.assertTrue((comp_dir / "explorer" / "ExplorerView.tsx").exists())
        self.assertTrue((comp_dir / "places" / "PlacesMapView.tsx").exists())
        self.assertTrue((comp_dir / "people" / "PeopleView.tsx").exists())
        self.assertTrue((comp_dir / "inspector" / "InspectorSidebar.tsx").exists())
        self.assertTrue((comp_dir / "sync" / "SyncModal.tsx").exists())
        self.assertTrue((comp_dir / "auth" / "LockScreenModal.tsx").exists())

    def test_vite_build_output_exists(self):
        """Verify production build bundle exists in dist/."""
        dist = ROOT / "dist"
        self.assertTrue(dist.exists(), "dist/ directory must exist")
        self.assertTrue((dist / "index.html").exists(), "dist/index.html must exist")
        assets = list((dist / "assets").glob("*.js"))
        self.assertGreater(len(assets), 0, "dist/assets must contain compiled javascript")

    def test_http_serves_react_app(self):
        """Test GET / serves React 19 app bundle."""
        status, data, headers = self._request("/")
        self.assertEqual(status, 200)
        self.assertIn("text/html", headers.get("content-type", "").lower())
        self.assertIn(b'<div id="root"></div>', data)
        self.assertIn(b"assets/index-", data)

    def test_http_serves_preview_fallback(self):
        """Test GET /preview routes to main application bundle."""
        status, data, _ = self._request("/preview")
        self.assertEqual(status, 200)
        self.assertIn(b'<div id="root"></div>', data)

    def test_universal_tunnel_disabled_by_default(self):
        """Test Universal Tunnel is switched OFF by default for privacy."""
        from neural_gallery.sync import is_tunnel_enabled, get_tunnel_url
        self.assertFalse(is_tunnel_enabled())
        self.assertIsNone(get_tunnel_url())

        # Test sync status endpoint reports tunnel_enabled=False
        status, data, _ = self._request("/api/sync/status")
        self.assertEqual(status, 200)
        body = json.loads(data.decode("utf-8"))
        self.assertFalse(body.get("tunnel_enabled"))
        self.assertIsNone(body.get("tunnel_url"))

    def test_gps_dms_parser(self):
        """Test EXIF GPS DMS coordinate parser with edge cases (NaN, bytes ref, negatives)."""
        from neural_gallery.scan import _parse_dms, _extract_gps
        # Standard positive degrees
        res = _parse_dms((37, 46, 29.8), "N")
        self.assertIsNotNone(res)
        self.assertAlmostEqual(res, 37.77494, places=4)

        # Negative longitude with bytes ref
        res_west = _parse_dms((122, 25, 9.8), b"W")
        self.assertIsNotNone(res_west)
        self.assertAlmostEqual(res_west, -122.41938, places=4)

        # South latitude
        res_south = _parse_dms((33, 51, 0.0), "S")
        self.assertIsNotNone(res_south)
        self.assertAlmostEqual(res_south, -33.85, places=2)

        # Reject NaN values from Samsung/Android empty GPS tags
        nan_res = _parse_dms((float("nan"), float("nan"), float("nan")), "N")
        self.assertIsNone(nan_res)

        # Reject null island in _extract_gps
        lat, lon, alt = _extract_gps({2: (0, 0, 0), 1: "N", 4: (0, 0, 0), 3: "E"})
        self.assertIsNone(lat)
        self.assertIsNone(lon)

    def test_folder_creation_storage_mode(self):
        """Test creating folders with virtual collection vs separate physical storage."""
        # 1. Virtual collection
        conn = HTTPConnection("127.0.0.1", self.port)
        conn.request(
            "POST",
            "/api/folders",
            json.dumps({"name": "Family Vacations", "storage_mode": "virtual"}),
            {"Content-Type": "application/json", "X-Neural-Gallery": "1"},
        )
        resp = conn.getresponse()
        self.assertEqual(resp.status, 200)
        data = json.loads(resp.read().decode("utf-8"))
        conn.close()
        self.assertEqual(data["name"], "Family Vacations")
        self.assertEqual(data["storage_mode"], "virtual")

        # 2. Physical storage folder
        conn = HTTPConnection("127.0.0.1", self.port)
        conn.request(
            "POST",
            "/api/folders",
            json.dumps({"name": "Private Project", "storage_mode": "physical"}),
            {"Content-Type": "application/json", "X-Neural-Gallery": "1"},
        )
        resp = conn.getresponse()
        self.assertEqual(resp.status, 200)
        data_phys = json.loads(resp.read().decode("utf-8"))
        conn.close()
        self.assertEqual(data_phys["name"], "Private Project")
        self.assertEqual(data_phys["storage_mode"], "physical")


if __name__ == "__main__":
    unittest.main()
