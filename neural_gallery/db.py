import os
import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    file_name TEXT,
    original_extension TEXT,
    mime_type TEXT,
    size INTEGER NOT NULL,
    mtime REAL NOT NULL,
    width INTEGER,
    height INTEGER,
    
    -- EXIF & Camera Optics
    has_camera INTEGER NOT NULL DEFAULT 0,
    camera_make TEXT,
    camera_model TEXT,
    lens_model TEXT,
    focal_length_mm REAL,
    aperture_f_number REAL,
    shutter_speed_seconds TEXT,
    iso_equivalent INTEGER,
    color_space TEXT DEFAULT 'Display P3',
    captured_at REAL,
    
    -- Geography & GPS Telemetry
    latitude REAL,
    longitude REAL,
    altitude_meters REAL,
    heading REAL,
    location_name TEXT,
    
    -- Apple & Android Native Media Classification Flags
    is_favorite INTEGER NOT NULL DEFAULT 0,
    is_screenshot INTEGER NOT NULL DEFAULT 0,
    is_video INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    is_live_photo INTEGER NOT NULL DEFAULT 0,
    is_portrait INTEGER NOT NULL DEFAULT 0,
    is_raw INTEGER NOT NULL DEFAULT 0,
    is_panorama INTEGER NOT NULL DEFAULT 0,
    is_selfie INTEGER NOT NULL DEFAULT 0,
    is_document INTEGER NOT NULL DEFAULT 0,
    is_hidden INTEGER NOT NULL DEFAULT 0,
    is_trashed INTEGER NOT NULL DEFAULT 0,
    is_imported INTEGER NOT NULL DEFAULT 0,
    
    -- Quality, Aesthetic, & Clustering
    quality_score REAL DEFAULT 5.0,
    blur_score REAL DEFAULT 0.0,
    dhash TEXT,
    label TEXT,
    category TEXT DEFAULT 'all',
    
    -- Tracking Metadata
    scanned_at REAL NOT NULL,
    faces_scanned INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS dup_groups (
    id INTEGER PRIMARY KEY,
    file_id INTEGER NOT NULL,
    group_key TEXT NOT NULL,
    UNIQUE(file_id)
);

CREATE TABLE IF NOT EXISTS roots (
    path TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS faces (
    id INTEGER PRIMARY KEY,
    file_id INTEGER NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    w REAL NOT NULL,
    h REAL NOT NULL,
    feature BLOB,
    person_key TEXT,
    confidence REAL NOT NULL DEFAULT 1.0,
    quality_score REAL NOT NULL DEFAULT 1.0,
    FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS people (
    person_key TEXT PRIMARY KEY,
    name TEXT,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    is_pet INTEGER NOT NULL DEFAULT 0,
    pet_type TEXT,
    face_count INTEGER NOT NULL DEFAULT 0,
    created_at REAL
);

CREATE TABLE IF NOT EXISTS asset_ocr (
    id INTEGER PRIMARY KEY,
    file_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 1.0,
    FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shared_albums (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    album_type TEXT NOT NULL DEFAULT 'local',
    created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS shared_album_files (
    album_id INTEGER NOT NULL,
    file_id INTEGER NOT NULL,
    PRIMARY KEY(album_id, file_id),
    FOREIGN KEY(album_id) REFERENCES shared_albums(id) ON DELETE CASCADE,
    FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
);
"""

INDEXES = """
-- Indices for performance
CREATE INDEX IF NOT EXISTS files_label ON files(label);
CREATE INDEX IF NOT EXISTS files_category ON files(category);
CREATE INDEX IF NOT EXISTS files_imported ON files(is_imported);
CREATE INDEX IF NOT EXISTS files_favorite ON files(is_favorite);
CREATE INDEX IF NOT EXISTS files_media_types ON files(is_video, is_screenshot, is_raw, is_portrait, is_live_photo);
CREATE INDEX IF NOT EXISTS files_location ON files(latitude, longitude);
CREATE INDEX IF NOT EXISTS dup_groups_key ON dup_groups(group_key);
CREATE INDEX IF NOT EXISTS faces_file ON faces(file_id);
CREATE INDEX IF NOT EXISTS faces_person ON faces(person_key);
CREATE INDEX IF NOT EXISTS ocr_file ON asset_ocr(file_id);
"""


def migrate(connection: sqlite3.Connection) -> None:
    """Safely migrate database to latest schema additions without data loss."""
    # Ensure base tables exist
    connection.executescript(SCHEMA)

    # 1. Migrate `files` table
    file_cols = {row[1] for row in connection.execute("PRAGMA table_info(files)")}
    
    new_file_columns = {
        "file_name": "TEXT",
        "original_extension": "TEXT",
        "mime_type": "TEXT",
        "camera_make": "TEXT",
        "camera_model": "TEXT",
        "lens_model": "TEXT",
        "focal_length_mm": "REAL",
        "aperture_f_number": "REAL",
        "shutter_speed_seconds": "TEXT",
        "iso_equivalent": "INTEGER",
        "color_space": "TEXT DEFAULT 'Display P3'",
        "captured_at": "REAL",
        "latitude": "REAL",
        "longitude": "REAL",
        "altitude_meters": "REAL",
        "heading": "REAL",
        "location_name": "TEXT",
        "is_favorite": "INTEGER NOT NULL DEFAULT 0",
        "is_video": "INTEGER NOT NULL DEFAULT 0",
        "duration_ms": "INTEGER NOT NULL DEFAULT 0",
        "is_live_photo": "INTEGER NOT NULL DEFAULT 0",
        "is_portrait": "INTEGER NOT NULL DEFAULT 0",
        "is_raw": "INTEGER NOT NULL DEFAULT 0",
        "is_panorama": "INTEGER NOT NULL DEFAULT 0",
        "is_selfie": "INTEGER NOT NULL DEFAULT 0",
        "is_document": "INTEGER NOT NULL DEFAULT 0",
        "is_hidden": "INTEGER NOT NULL DEFAULT 0",
        "is_trashed": "INTEGER NOT NULL DEFAULT 0",
        "is_imported": "INTEGER NOT NULL DEFAULT 0",
        "quality_score": "REAL DEFAULT 5.0",
        "blur_score": "REAL DEFAULT 0.0",
        "category": "TEXT DEFAULT 'all'",
        "faces_scanned": "INTEGER NOT NULL DEFAULT 0",
    }

    for col_name, col_def in new_file_columns.items():
        if col_name not in file_cols:
            connection.execute(f"ALTER TABLE files ADD COLUMN {col_name} {col_def}")

    # 2. Migrate `people` table
    people_cols = {row[1] for row in connection.execute("PRAGMA table_info(people)")}
    new_people_columns = {
        "is_favorite": "INTEGER NOT NULL DEFAULT 0",
        "is_pet": "INTEGER NOT NULL DEFAULT 0",
        "pet_type": "TEXT",
        "face_count": "INTEGER NOT NULL DEFAULT 0",
        "created_at": "REAL",
    }
    for col_name, col_def in new_people_columns.items():
        if col_name not in people_cols:
            connection.execute(f"ALTER TABLE people ADD COLUMN {col_name} {col_def}")

    # 3. Migrate `faces` table
    faces_cols = {row[1] for row in connection.execute("PRAGMA table_info(faces)")}
    new_face_columns = {
        "confidence": "REAL NOT NULL DEFAULT 1.0",
        "quality_score": "REAL NOT NULL DEFAULT 1.0",
    }
    for col_name, col_def in new_face_columns.items():
        if col_name not in faces_cols:
            connection.execute(f"ALTER TABLE faces ADD COLUMN {col_name} {col_def}")

    # 4. Migrate `shared_albums` table for hidden private folders
    album_cols = {row[1] for row in connection.execute("PRAGMA table_info(shared_albums)")}
    if "is_hidden" not in album_cols:
        connection.execute("ALTER TABLE shared_albums ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0")

    # 5. Create indexes after all columns and tables exist
    connection.executescript(INDEXES)


def connect(db_path: Path) -> sqlite3.Connection:
    db_path = Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    if not db_path.exists():
        db_path.touch(mode=0o600)
    previous = os.umask(0o077)
    try:
        connection = sqlite3.connect(db_path, timeout=30)
    finally:
        os.umask(previous)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    migrate(connection)
    os.chmod(db_path, 0o600)
    for suffix in ("-wal", "-shm"):
        sidecar = Path(str(db_path) + suffix)
        if sidecar.exists():
            os.chmod(sidecar, 0o600)
    return connection


def default_db() -> Path:
    return Path.home() / "Library" / "Application Support" / "Neural Gallery" / "neural_gallery.sqlite"
