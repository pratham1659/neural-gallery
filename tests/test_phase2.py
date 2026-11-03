"""Tests for Phase 2: Modern API endpoints, metadata querying, and UI integration."""

import json
import tempfile
import threading
import unittest
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

from PIL import Image

from neural_gallery.actions import toggle_favorite, toggle_hidden, mark_trashed, set_category, get_photo_detail
from neural_gallery.db import connect
from neural_gallery.faces import list_candidates, confirm_candidate, merge_people, name_person
from neural_gallery.review import make_handler, query_photos, map_pins, sync_status, _stats


class Phase2ApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.folder = Path(self.temp_dir.name)
        self.db_path = self.folder / "test_phase2.sqlite"
        self.conn = connect(self.db_path)

        # Seed test files
        self.file1_path = self.folder / "photo1.jpg"
        self.file2_path = self.folder / "photo2.png"
        self.file3_path = self.folder / "video1.mp4"
        self.file4_path = self.folder / "raw1.dng"

        # Create dummy files
        img = Image.new("RGB", (1200, 800), color=(100, 150, 200))
        img.save(self.file1_path)
        img.save(self.file2_path)
        self.file3_path.write_bytes(b"dummy video data")
        self.file4_path.write_bytes(b"dummy raw dng data")

        self.conn.execute("INSERT INTO roots(path) VALUES (?)", (str(self.folder),))

        # Insert record 1: Landscape with camera and GPS
        self.conn.execute(
            """
            INSERT INTO files(
                path, size, mtime, width, height, is_favorite, is_screenshot,
                camera_make, camera_model, lens_model, focal_length_mm, aperture_f_number, shutter_speed_seconds, iso_equivalent,
                latitude, longitude, location_name, quality_score, blur_score, category, scanned_at
            ) VALUES (?, 1024, 1000.0, 1200, 800, 1, 0,
                      'Apple', 'iPhone 16 Pro', '24mm f/1.78', 24.0, 1.78, '1/250s', 100,
                      37.7749, -122.4194, 'San Francisco', 8.5, 95.0, 'all', 1000.0)
            """,
            (str(self.file1_path),),
        )
        self.id1 = self.conn.execute("SELECT last_insert_rowid()").fetchone()[0]

        # Insert record 2: Screenshot
        self.conn.execute(
            """
            INSERT INTO files(
                path, size, mtime, width, height, is_favorite, is_screenshot, category, scanned_at
            ) VALUES (?, 2048, 2000.0, 1170, 2532, 0, 1, 'screenshot', 2000.0)
            """,
            (str(self.file2_path),),
        )
        self.id2 = self.conn.execute("SELECT last_insert_rowid()").fetchone()[0]

        # Insert record 3: Video
        self.conn.execute(
            """
            INSERT INTO files(
                path, size, mtime, width, height, is_video, category, scanned_at
            ) VALUES (?, 8192, 3000.0, 1920, 1080, 1, 'video', 3000.0)
            """,
            (str(self.file3_path),),
        )
        self.id3 = self.conn.execute("SELECT last_insert_rowid()").fetchone()[0]

        # Insert record 4: ProRAW
        self.conn.execute(
            """
            INSERT INTO files(
                path, size, mtime, width, height, is_raw, category, scanned_at
            ) VALUES (?, 16384, 4000.0, 8064, 6048, 1, 'raw', 4000.0)
            """,
            (str(self.file4_path),),
        )
        self.id4 = self.conn.execute("SELECT last_insert_rowid()").fetchone()[0]

        # Insert face and people
        self.conn.execute(
            "INSERT INTO faces(file_id, x, y, w, h, person_key, confidence) VALUES (?, 0.2, 0.3, 0.1, 0.1, 'p1', 0.99)",
            (self.id1,),
        )
        self.face_id1 = self.conn.execute("SELECT last_insert_rowid()").fetchone()[0]

        self.conn.execute(
            "INSERT INTO faces(file_id, x, y, w, h, person_key, confidence) VALUES (?, 0.5, 0.5, 0.15, 0.15, 'p2', 0.95)",
            (self.id2,),
        )
        self.face_id2 = self.conn.execute("SELECT last_insert_rowid()").fetchone()[0]

        name_person(self.conn, "p1", "Eleanor", is_pet=False)
        self.conn.commit()

        # Start HTTP server for API tests
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(self.db_path))
        self.server_thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.server_thread.start()
        self.port = self.server.server_address[1]
        self.base_url = f"http://127.0.0.1:{self.port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.conn.close()
        self.temp_dir.cleanup()

    def _post(self, path: str, data: dict, headers: dict | None = None) -> tuple[int, dict]:
        req_headers = {"Content-Type": "application/json", "X-Neural-Gallery": "1"}
        if headers:
            req_headers.update(headers)
        req = urllib.request.Request(
            f"{self.base_url}{path}",
            data=json.dumps(data).encode("utf-8"),
            headers=req_headers,
        )
        try:
            with urllib.request.urlopen(req) as resp:
                return resp.status, json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            return exc.code, json.loads(exc.read().decode("utf-8"))

    def _get(self, path: str) -> tuple[int, any]:
        req = urllib.request.Request(f"{self.base_url}{path}")
        try:
            with urllib.request.urlopen(req) as resp:
                raw = resp.read().decode("utf-8")
                content_type = resp.headers.get("Content-Type", "")
                if "application/json" in content_type:
                    return resp.status, json.loads(raw)
                return resp.status, raw
        except urllib.error.HTTPError as exc:
            return exc.code, exc.read().decode("utf-8")

    def test_stats_endpoint(self):
        status, data = self._get("/api/stats")
        self.assertEqual(status, 200)
        self.assertEqual(data["total"], 4)
        self.assertEqual(data["favorites"], 1)
        self.assertEqual(data["screenshots"], 1)
        self.assertEqual(data["videos"], 1)
        self.assertEqual(data["raw"], 1)
        self.assertEqual(data["geocoded"], 1)
        self.assertEqual(data["people"], 2)

    def test_photos_query_and_filtering(self):
        # All photos
        status, all_photos = self._get("/api/photos?category=all")
        self.assertEqual(status, 200)
        self.assertEqual(len(all_photos), 4)

        # Favorites
        status, favs = self._get("/api/photos?category=favorites")
        self.assertEqual(status, 200)
        self.assertEqual(len(favs), 1)
        self.assertEqual(favs[0]["id"], self.id1)
        self.assertTrue(favs[0]["is_favorite"])

        # Screenshots
        status, shots = self._get("/api/photos?category=screenshots")
        self.assertEqual(status, 200)
        self.assertEqual(len(shots), 1)
        self.assertEqual(shots[0]["id"], self.id2)

        # Videos
        status, vids = self._get("/api/photos?category=videos")
        self.assertEqual(status, 200)
        self.assertEqual(len(vids), 1)
        self.assertEqual(vids[0]["id"], self.id3)

        # RAW
        status, raws = self._get("/api/photos?category=raw")
        self.assertEqual(status, 200)
        self.assertEqual(len(raws), 1)
        self.assertEqual(raws[0]["id"], self.id4)

    def test_photo_detail_endpoint(self):
        status, detail = self._get(f"/api/photo?id={self.id1}")
        self.assertEqual(status, 200)
        self.assertEqual(detail["camera_model"], "iPhone 16 Pro")
        self.assertEqual(detail["city"], "San Francisco")
        self.assertEqual(detail["latitude"], 37.7749)
        self.assertEqual(len(detail["faces"]), 1)
        self.assertEqual(detail["faces"][0]["name"], "Eleanor")

    def test_favorite_toggle_post_endpoint(self):
        # Toggle off
        status, data = self._post("/api/favorite", {"id": self.id1})
        self.assertEqual(status, 200)
        self.assertFalse(data["is_favorite"])

        # Check DB
        status, favs = self._get("/api/photos?category=favorites")
        self.assertEqual(len(favs), 0)

        # Toggle back on
        status, data = self._post("/api/favorite", {"id": self.id1, "is_favorite": True})
        self.assertEqual(status, 200)
        self.assertTrue(data["is_favorite"])

    def test_hide_and_trash_post_endpoints(self):
        # Hide photo 2
        status, data = self._post("/api/hide", {"id": self.id2, "is_hidden": True})
        self.assertEqual(status, 200)
        self.assertTrue(data["is_hidden"])

        # Query hidden
        status, hidden_photos = self._get("/api/photos?category=hidden")
        self.assertEqual(len(hidden_photos), 1)
        self.assertEqual(hidden_photos[0]["id"], self.id2)

        # Soft trash photo 3
        status, data = self._post("/api/trash", {"id": self.id3, "soft": True})
        self.assertEqual(status, 200)
        self.assertTrue(data["trashed"])

        # Query trash
        status, trashed = self._get("/api/photos?category=trash")
        self.assertEqual(len(trashed), 1)
        self.assertEqual(trashed[0]["id"], self.id3)

    def test_map_pins_endpoint(self):
        status, pins = self._get("/api/map/pins")
        self.assertEqual(status, 200)
        self.assertEqual(len(pins), 1)
        self.assertEqual(pins[0]["city"], "San Francisco")
        self.assertEqual(pins[0]["latitude"], 37.7749)
        self.assertTrue(pins[0]["thumb"].startswith(f"/media/{self.id1}"))

    def test_people_candidates_and_confirm(self):
        # p2 has no name yet, so face_id2 should be a candidate
        status, candidates = self._get("/api/people/candidates")
        self.assertEqual(status, 200)
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0]["face_id"], self.face_id2)

        # Confirm candidate into p1
        status, res = self._post("/api/person/confirm", {"face_id": self.face_id2, "person_key": "p1"})
        self.assertEqual(status, 200)
        self.assertEqual(res["person_key"], "p1")

        # Candidates should now be 0
        status, candidates_after = self._get("/api/people/candidates")
        self.assertEqual(len(candidates_after), 0)

    def test_people_merge(self):
        # Merge p2 into p1
        status, res = self._post("/api/person/merge", {"source": "p2", "target": "p1"})
        self.assertEqual(status, 200)
        self.assertTrue(res["merged"])

    def test_sync_status_and_pair(self):
        status, sync = self._get("/api/sync/status")
        self.assertEqual(status, 200)
        self.assertEqual(sync["tls_version"], "TLS 1.3")
        self.assertEqual(sync["service_name"], "_photovault._tcp.local.")

        status, pair = self._post("/api/sync/pair", {"pin": "849 201"})
        self.assertEqual(status, 200)
        self.assertTrue(pair["paired"])

    def test_search_endpoint(self):
        status, res = self._get("/api/search?q=Francisco")
        self.assertEqual(status, 200)
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0]["id"], self.id1)

    def test_preview_html_served_at_root(self):
        status, html = self._get("/")
        self.assertEqual(status, 200)
        self.assertIn("Neural Gallery", html)

    def test_legacy_page_served_at_legacy(self):
        status, html = self._get("/legacy")
        self.assertEqual(status, 200)
        self.assertIn("<!DOCTYPE html>", html)


if __name__ == "__main__":
    unittest.main()
