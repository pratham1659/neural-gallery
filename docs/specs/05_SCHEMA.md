# Aperture Vault — Backend & Database Schema Specification

**Document Version:** 1.0.0-PROD  
**Author:** Principal Systems Architect & Lead Desktop Security Engineer  
**Database Engine:** SQLCipher 4.6+ (OpenSSL 3.x / Apple CommonCrypto Backend)  
**Vector Extension:** `sqlite-vec` (Embedded C Vector Virtual Tables)  
**Search Extensions:** SQLite FTS5 (Full-Text Search) & R*Tree (Spatial Indexing)  

---

## 1. Encrypted Database Engine Configuration

The persistence layer is governed entirely within an authenticated, encrypted SQLCipher database container. Decryption occurs purely within RAM pages managed by SQLCipher's memory allocator.

### 1.1 PRAGMA Tuning & Cryptographic Bootstrap
Immediately following database connection establishment, the Rust core issues the following initialization commands:

```sql
-- 1. Inject Raw 256-bit Key derived via HKDF-Expand(VMK, "aperture-sqlcipher-v1")
PRAGMA key = "x'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'";

-- 2. Enforce Page Size & HMAC Authentication Configuration
PRAGMA cipher_page_size = 4096;
PRAGMA kdf_iter = 64000;
PRAGMA cipher_hmac_algorithm = HMAC_SHA512;
PRAGMA cipher_default_kdf_algorithm = PBKDF2_HMAC_SHA512;

-- 3. Concurrency & Performance Primitives
PRAGMA journal_mode = WAL;               -- Write-Ahead Logging for non-blocking concurrent reads
PRAGMA synchronous = NORMAL;            -- Resilient durability without fsync bottlenecks
PRAGMA cache_size = -65536;             -- 64 MiB in-memory page cache allocation
PRAGMA foreign_keys = ON;               -- Enforce relational referential integrity
PRAGMA temp_store = MEMORY;             -- Strict guard: Force temporary tables and sorts into RAM only
```

---

## 2. Complete Data Definition Language (DDL)

### 2.1 Vault Metadata & Configuration Table

```sql
CREATE TABLE IF NOT EXISTS vault_metadata (
    key                 TEXT PRIMARY KEY,
    value               TEXT NOT NULL,
    updated_at          INTEGER NOT NULL
) WITHOUT ROWID;

-- Initial Seed Records
INSERT OR IGNORE INTO vault_metadata (key, value, updated_at) VALUES
('schema_version', '1.0.0', strftime('%s', 'now') * 1000),
('vault_uuid', hex(randomblob(16)), strftime('%s', 'now') * 1000),
('created_at', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);
```

### 2.2 Primary Media Assets Table (`media_assets`)

```sql
CREATE TABLE IF NOT EXISTS media_assets (
    id                  TEXT PRIMARY KEY,          -- UUIDv4 format
    file_name           TEXT NOT NULL,             -- Original file name (e.g. IMG_4012.HEIC)
    original_extension  TEXT NOT NULL,             -- Extracted lower-case extension (heic, dng, mov)
    mime_type           TEXT NOT NULL,             -- IANA MIME type (image/heic, video/quicktime)
    byte_size           INTEGER NOT NULL,          -- Unencrypted original payload size in bytes
    blake3_hash         TEXT NOT NULL UNIQUE,      -- Cryptographic BLAKE3 hash for instant deduplication
    
    -- Encrypted Storage Mapping
    storage_rel_path    TEXT NOT NULL,             -- Relative path within vault container (.aev blob)
    encryption_iv       BLOB NOT NULL,             -- 96-bit AES-GCM Initialization Vector (12 bytes)
    encryption_tag      BLOB NOT NULL,             -- 128-bit AES-GCM Authentication Tag (16 bytes)
    
    -- Visual Dimensions & Preview Cache
    width               INTEGER NOT NULL,          -- Pixel width
    height              INTEGER NOT NULL,          -- Pixel height
    duration_ms         INTEGER DEFAULT 0,         -- Video playback duration (0 for still photos)
    blurhash            TEXT,                      -- Compact BlurHash string (~32-48 chars)
    micro_thumbnail     BLOB,                      -- 64x64 ultra-compressed WebP thumbnail in-DB
    
    -- Temporal Metadata
    captured_at         INTEGER NOT NULL,          -- Capture timestamp (UNIX epoch in milliseconds)
    captured_tz_offset  INTEGER DEFAULT 0,         -- Timezone offset in seconds (+3600, -18000, etc.)
    ingested_at         INTEGER NOT NULL,          -- Ingestion timestamp (UNIX epoch in milliseconds)
    
    -- Geolocation & Spatial Metadata
    latitude            REAL,                      -- WGS84 Latitude (-90.0 to +90.0)
    longitude           REAL,                      -- WGS84 Longitude (-180.0 to +180.0)
    altitude            REAL,                      -- Meters above sea level
    place_name          TEXT,                      -- Reverse-geocoded string (e.g. "Kyoto, Japan")
    country_code        TEXT,                      -- ISO 3166-1 alpha-2 code (e.g. "JP")
    
    -- Camera & Photographic Parameters (EXIF)
    camera_make         TEXT,                      -- e.g. "Apple", "Sony", "Nikon"
    camera_model        TEXT,                      -- e.g. "iPhone 16 Pro", "ILCE-7M4"
    lens_model          TEXT,                      -- e.g. "FE 24-70mm F2.8 GM II"
    focal_length_mm     REAL,                      -- Optical focal length
    aperture_f_stop     REAL,                      -- F-number (e.g. 2.8, 1.8)
    iso_speed           INTEGER,                   -- ISO sensitivity (e.g. 100, 6400)
    exposure_time       TEXT,                      -- Human-readable shutter string (e.g. "1/2500")
    
    -- Operational Flags
    is_favorite         INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
    is_trashed          INTEGER NOT NULL DEFAULT 0 CHECK (is_trashed IN (0, 1)),
    trashed_at          INTEGER
);
```

### 2.3 People Clustering & Facial Recognition Tables (`persons` & `face_instances`)

```sql
-- Clustered Identity Catalog
CREATE TABLE IF NOT EXISTS persons (
    id                  TEXT PRIMARY KEY,          -- UUIDv4 format
    name                TEXT,                      -- User-assigned identity (NULL if unassigned)
    is_hidden           INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)),
    cover_face_id       TEXT,                      -- Reference to representative face crop
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
);

-- Individual Face Bounding Boxes & Embeddings
CREATE TABLE IF NOT EXISTS face_instances (
    id                  TEXT PRIMARY KEY,          -- UUIDv4 format
    asset_id            TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    person_id           TEXT REFERENCES persons(id) ON DELETE SET NULL,
    
    -- Normalized Bounding Box Coordinates (0.0 to 1.0 relative to image dimensions)
    bbox_x              REAL NOT NULL,
    bbox_y              REAL NOT NULL,
    bbox_w              REAL NOT NULL,
    bbox_h              REAL NOT NULL,
    
    -- Apple Vision Quality & Landmarks
    detection_conf      REAL NOT NULL,             -- Vision framework confidence score (0.0 - 1.0)
    face_quality        REAL,                      -- VNFaceObservation faceCaptureQuality score
    face_crop_blob      BLOB,                      -- 128x128 encrypted WebP face thumbnail
    
    -- Facial Feature Embedding
    embedding_512       BLOB NOT NULL,             -- 512-dimensional float32 vector (2048 bytes)
    created_at          INTEGER NOT NULL
);
```

### 2.4 Optical Character Recognition (OCR) Index (`asset_ocr` via SQLite FTS5)

```sql
-- Full-Text Search Virtual Table for Text Scanned in Media
CREATE VIRTUAL TABLE IF NOT EXISTS asset_ocr USING fts5(
    asset_id UNINDEXED,                            -- Foreign key reference to media_assets(id)
    recognized_text,                               -- All extracted text strings concatenated
    tokenize = 'unicode61 remove_diacritics 2'     -- Multi-language unicode tokenizer
);
```

### 2.5 Semantic Natural Language Vector Index (`vec_embeddings` via `sqlite-vec`)

```sql
-- 768-Dimensional Vector Virtual Table for MobileCLIP Embeddings
CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
    asset_id            TEXT PRIMARY KEY,
    embedding           float[768] distance_metric=cosine
);
```

### 2.6 Spatial Indexing Table (`spatial_index` via SQLite R*Tree)

```sql
-- R*Tree Spatial Virtual Table for Sub-Millisecond Geographic Bounding Box Queries
CREATE VIRTUAL TABLE IF NOT EXISTS spatial_index USING rtree(
    id                  INTEGER PRIMARY KEY,       -- Internal rowid matching media_assets rowid
    min_lat             REAL,                      -- Minimum Latitude
    max_lat             REAL,                      -- Maximum Latitude
    min_lon             REAL,                      -- Minimum Longitude
    max_lon             REAL                       -- Maximum Longitude
);
```

---

## 3. Indexing Strategy & Performance Triggers

### 3.1 B-Tree Indexes for 60–120 fps Virtualized Scrolling

```sql
-- Primary Gallery Index: Filter non-trashed items, order by capture timestamp descending
CREATE INDEX IF NOT EXISTS idx_media_assets_timeline 
ON media_assets (is_trashed, captured_at DESC) 
INCLUDE (id, width, height, blurhash, place_name);

-- Instant Deduplication Index: O(1) existence checks upon ingestion
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_assets_blake3 
ON media_assets (blake3_hash);

-- Reverse Geocoding Filter Index
CREATE INDEX IF NOT EXISTS idx_media_assets_country_place 
ON media_assets (country_code, place_name) 
WHERE is_trashed = 0;

-- Foreign Key Lookup Optimization
CREATE INDEX IF NOT EXISTS idx_face_instances_asset 
ON face_instances (asset_id);

CREATE INDEX IF NOT EXISTS idx_face_instances_person 
ON face_instances (person_id);
```

### 3.2 Automated Synchronization Triggers

```sql
-- 1. Sync media_assets inserts into the R*Tree Spatial Index
CREATE TRIGGER IF NOT EXISTS trg_media_assets_spatial_insert
AFTER INSERT ON media_assets
WHEN NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL
BEGIN
    INSERT INTO spatial_index (id, min_lat, max_lat, min_lon, max_lon)
    VALUES (NEW.rowid, NEW.latitude, NEW.latitude, NEW.longitude, NEW.longitude);
END;

-- 2. Sync media_assets updates into the R*Tree Spatial Index
CREATE TRIGGER IF NOT EXISTS trg_media_assets_spatial_update
AFTER UPDATE OF latitude, longitude ON media_assets
WHEN NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL
BEGIN
    DELETE FROM spatial_index WHERE id = OLD.rowid;
    INSERT INTO spatial_index (id, min_lat, max_lat, min_lon, max_lon)
    VALUES (NEW.rowid, NEW.latitude, NEW.latitude, NEW.longitude, NEW.longitude);
END;

-- 3. Cleanup R*Tree upon media asset deletion
CREATE TRIGGER IF NOT EXISTS trg_media_assets_spatial_delete
AFTER DELETE ON media_assets
BEGIN
    DELETE FROM spatial_index WHERE id = OLD.rowid;
    DELETE FROM asset_ocr WHERE asset_id = OLD.id;
    DELETE FROM vec_embeddings WHERE asset_id = OLD.id;
END;
```

---

## 4. High-Throughput Production Query Patterns

### 4.1 Chronological Timeline Viewport Query (Virtual Scroll Slice)
```sql
-- Hydrate 80 visible items with micro-metadata and blurhashes in < 2ms
SELECT 
    id, file_name, width, height, blurhash, micro_thumbnail, 
    captured_at, captured_tz_offset, place_name, mime_type, is_favorite
FROM media_assets
WHERE is_trashed = 0
ORDER BY captured_at DESC
LIMIT 80 OFFSET ?;
```

### 4.2 Natural Language Semantic Search Query (MobileCLIP + `sqlite-vec`)
```sql
-- Query top 40 nearest neighbors using cosine similarity over 768-d query vector
SELECT 
    m.id, 
    m.file_name, 
    m.width, 
    m.height, 
    m.blurhash, 
    m.captured_at, 
    m.place_name,
    v.distance AS semantic_distance
FROM vec_embeddings v
JOIN media_assets m ON m.id = v.asset_id
WHERE v.embedding MATCH ?              -- Bound to binary Float32 buffer of query vector
  AND k = 40                           -- Return top 40 nearest neighbors
  AND m.is_trashed = 0
ORDER BY v.distance ASC;
```

### 4.3 Multi-Modal Hybrid Search (OCR Full-Text + Semantic Vector)
```sql
-- Combine exact OCR keyword hits with semantic CLIP similarity
WITH text_matches AS (
    SELECT asset_id, rank * -1.0 AS score
    FROM asset_ocr
    WHERE asset_ocr MATCH ?
    LIMIT 100
),
vector_matches AS (
    SELECT asset_id, (1.0 - distance) AS score
    FROM vec_embeddings
    WHERE embedding MATCH ?
      AND k = 100
)
SELECT 
    m.id, m.file_name, m.captured_at, m.blurhash,
    COALESCE(tm.score, 0.0) * 1.5 + COALESCE(vm.score, 0.0) AS hybrid_score
FROM media_assets m
LEFT JOIN text_matches tm ON m.id = tm.asset_id
LEFT JOIN vector_matches vm ON m.id = vm.asset_id
WHERE (tm.asset_id IS NOT NULL OR vm.asset_id IS NOT NULL)
  AND m.is_trashed = 0
ORDER BY hybrid_score DESC
LIMIT 50;
```

### 4.4 Spatial Bounding Box Query (Interactive Map Cluster)
```sql
-- Retrieve all photos within the map viewport using R*Tree index
SELECT 
    m.id, m.latitude, m.longitude, m.place_name, m.blurhash
FROM spatial_index s
JOIN media_assets m ON m.rowid = s.id
WHERE s.min_lat >= :viewport_south
  AND s.max_lat <= :viewport_north
  AND s.min_lon >= :viewport_west
  AND s.max_lon <= :viewport_east
  AND m.is_trashed = 0;
```
