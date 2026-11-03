import sqlite3
import tempfile
import unittest
from pathlib import Path
from PIL import Image

from neural_gallery.actions import toggle_favorite, set_category
from neural_gallery.db import connect, migrate, SCHEMA
from neural_gallery.faces import list_people, name_person
from neural_gallery.scan import (
    _parse_dms,
    _extract_gps,
    index_file,
    looks_like_document,
    looks_like_screenshot,
)


class TestPhase1DatabaseAndMetadata(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test.sqlite"
        self.conn = connect(self.db_path)

    def tearDown(self):
        self.conn.close()
        self.temp_dir.cleanup()

    def test_schema_has_extended_columns(self):
        file_cols = {row[1] for row in self.conn.execute("PRAGMA table_info(files)")}
        expected = {
            "camera_make", "camera_model", "lens_model", "focal_length_mm",
            "aperture_f_number", "shutter_speed_seconds", "iso_equivalent",
            "latitude", "longitude", "altitude_meters",
            "is_favorite", "is_video", "is_live_photo", "is_portrait",
            "is_raw", "is_panorama", "is_selfie", "is_document",
            "quality_score", "blur_score", "category",
        }
        for col in expected:
            self.assertIn(col, file_cols, f"Column {col} missing from files table")

    def test_people_schema_has_pet_columns(self):
        people_cols = {row[1] for row in self.conn.execute("PRAGMA table_info(people)")}
        self.assertIn("is_pet", people_cols)
        self.assertIn("pet_type", people_cols)
        self.assertIn("is_favorite", people_cols)

    def test_migration_preserves_data(self):
        old_db_path = Path(self.temp_dir.name) / "legacy.sqlite"
        legacy_conn = sqlite3.connect(old_db_path)
        legacy_conn.execute("""
            CREATE TABLE files (
                id INTEGER PRIMARY KEY,
                path TEXT NOT NULL UNIQUE,
                size INTEGER NOT NULL,
                mtime REAL NOT NULL,
                width INTEGER,
                height INTEGER,
                has_camera INTEGER NOT NULL DEFAULT 0,
                is_screenshot INTEGER NOT NULL DEFAULT 0,
                dhash TEXT,
                label TEXT,
                scanned_at REAL NOT NULL
            )
        """)
        legacy_conn.execute("""
            INSERT INTO files(path, size, mtime, width, height, scanned_at)
            VALUES ('/tmp/photo1.jpg', 1024, 123456.0, 800, 600, 123456.0)
        """)
        legacy_conn.commit()
        legacy_conn.close()

        # Connect with new db module, which runs migrate()
        migrated_conn = connect(old_db_path)
        row = migrated_conn.execute("SELECT * FROM files WHERE path = '/tmp/photo1.jpg'").fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row["size"], 1024)
        self.assertEqual(row["is_favorite"], 0)
        migrated_conn.close()

    def test_gps_dms_parsing(self):
        # 35 deg 40 min 35.04 sec N -> 35.6764
        dms = (35, 40, 35.04)
        deg = _parse_dms(dms, "N")
        self.assertAlmostEqual(deg, 35.6764, places=3)

        # West should be negative
        deg_w = _parse_dms((122, 25, 9.84), "W")
        self.assertAlmostEqual(deg_w, -122.4194, places=3)

    def test_toggle_favorite_action(self):
        self.conn.execute("""
            INSERT INTO files(path, size, mtime, width, height, scanned_at)
            VALUES ('/tmp/fav_test.jpg', 2048, 100.0, 1920, 1080, 100.0)
        """)
        file_id = self.conn.execute("SELECT id FROM files WHERE path = '/tmp/fav_test.jpg'").fetchone()[0]

        # Initially 0
        state1 = toggle_favorite(self.conn, file_id)
        self.assertTrue(state1)
        row = self.conn.execute("SELECT is_favorite FROM files WHERE id = ?", (file_id,)).fetchone()
        self.assertEqual(row["is_favorite"], 1)

        # Toggle back to 0
        state2 = toggle_favorite(self.conn, file_id)
        self.assertFalse(state2)
        row = self.conn.execute("SELECT is_favorite FROM files WHERE id = ?", (file_id,)).fetchone()
        self.assertEqual(row["is_favorite"], 0)

    def test_set_category_action(self):
        self.conn.execute("""
            INSERT INTO files(path, size, mtime, width, height, scanned_at)
            VALUES ('/tmp/cat_test.jpg', 2048, 100.0, 1920, 1080, 100.0)
        """)
        file_id = self.conn.execute("SELECT id FROM files WHERE path = '/tmp/cat_test.jpg'").fetchone()[0]

        set_category(self.conn, file_id, "travel")
        row = self.conn.execute("SELECT category FROM files WHERE id = ?", (file_id,)).fetchone()
        self.assertEqual(row["category"], "travel")

    def test_pet_naming_and_listing(self):
        # Insert test face
        self.conn.execute("""
            INSERT INTO files(path, size, mtime, width, height, scanned_at)
            VALUES ('/tmp/dog.jpg', 2048, 100.0, 1920, 1080, 100.0)
        """)
        file_id = self.conn.execute("SELECT id FROM files WHERE path = '/tmp/dog.jpg'").fetchone()[0]
        self.conn.execute("""
            INSERT INTO faces(file_id, x, y, w, h, person_key)
            VALUES (?, 0.1, 0.1, 0.2, 0.2, 'p100')
        """, (file_id,))
        self.conn.commit()

        name_person(self.conn, "p100", "Milo", is_pet=True, pet_type="dog")
        people = list_people(self.conn)
        self.assertEqual(len(people), 1)
        self.assertEqual(people[0]["name"], "Milo")
        self.assertTrue(people[0]["is_pet"])
        self.assertEqual(people[0]["pet_type"], "dog")

    def test_index_file_with_synthetic_image(self):
        img_path = Path(self.temp_dir.name) / "test_img.jpg"
        img = Image.new("RGB", (640, 480), color=(100, 150, 200))
        img.save(img_path)

        record = index_file(img_path)
        self.assertIsNotNone(record)
        self.assertEqual(record["width"], 640)
        self.assertEqual(record["height"], 480)
        self.assertEqual(record["is_video"], 0)
        self.assertEqual(record["is_raw"], 0)
        self.assertIn("quality_score", record)


if __name__ == "__main__":
    unittest.main()
