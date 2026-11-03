# Aperture Vault — App Flow & State Machine Specification

**Document Version:** 1.0.0-PROD  
**Author:** Principal Systems Architect & Lead Desktop Security Engineer  
**Target Architecture:** Apple Silicon (macOS Sonoma / Sequoia)  
**Primary Engine:** Tauri 2.0 / Rust Core + Swift Acceleration  

---

## 1. Global Application State Machine

The security and operational model of Aperture Vault is governed by a deterministic, finite-state machine (FSM). State transitions enforce strict memory lifecycle boundaries, ensuring that cryptographic materials exist in volatile memory only during active user sessions.

### 1.1 State Machine Diagram

```
                              ┌─────────────────────────┐
                              │     [UNINITIALIZED]     │
                              │ (First Launch / Setup)  │
                              └────────────┬────────────┘
                                           │ Vault Initialized & Encrypted
                                           ▼
         ┌─────────────────────────────────────────────────────────────────┐
         │                                                                 │
         │                         ┌──────────────┐                        │
         │                         │   [LOCKED]   │                        │
         │                         │ (Zero-State) │                        │
         │                         └───────┬──────┘                        │
         │                                 │                               │
         │                User Input       │ Biometric Trigger             │
         │                (Master Pass)    │ (Touch ID / Secure Enclave)   │
         │                                 ▼                               │
         │                     ┌───────────────────────┐                   │
         │                     │   [AUTHENTICATING]    │                   │
         │                     │  (Argon2id / KDF)     │                   │
         │                     └───────────┬───────────┘                   │
         │                                 │                               │
         │                  Key Validated  │ Key Derivation Failed         │
         │                  (VMK Loaded)   ▼ (Rate Limit / Delay)          │
         │                                 │                               │
         │                                 ▼                               │
         │                     ┌───────────────────────┐                   │
         │                     │   [UNLOCKED_ACTIVE]   │                   │
         │                     └───────────┬───────────┘                   │
         │                                 │                               │
         │             Session Interrupted │ `Cmd+L` / Inactivity / Sleep  │
         │                                 ▼                               │
         │                     ┌───────────────────────┐                   │
         │                     │  [LOCKED_ZEROIZING]   │                   │
         │                     │ (`sodium_memzero`)    │                   │
         │                     └───────────┬───────────┘                   │
         │                                 │                               │
         └─────────────────────────────────┴───────────────────────────────┘
```

### 1.2 State Transition Matrix

| Current State | Trigger / Event | Guard / Precondition | Action Executed | Next State |
| :--- | :--- | :--- | :--- | :--- |
| **UNINITIALIZED** | `CREATE_VAULT` | Passphrase complexity validated; Target directory writable | Generate 256-bit VMK; Derive KEK via Argon2id; Enroll Touch ID; Write vault header; Initialize SQLCipher schema | **LOCKED** |
| **LOCKED** | `SUBMIT_PASSPHRASE` | Password non-empty; Backoff rate-limit expired | Spin Argon2id worker thread; Set UI to authenticating state | **AUTHENTICATING** |
| **LOCKED** | `TRIGGER_TOUCH_ID` | Secure Enclave key present; Biometrics enrolled | Invoke `LAContext.evaluatePolicy`; Retrieve wrapped VMK | **AUTHENTICATING** |
| **AUTHENTICATING** | `AUTH_SUCCESS` | Derived key matches header HMAC; Decryption test passes | Allocate `mlock` memory; Inject key to SQLCipher; Start mDNS service; Load timeline viewport | **UNLOCKED_ACTIVE** |
| **AUTHENTICATING** | `AUTH_FAILURE` | Derived key fails HMAC verification | Increment failure counter; Exponential backoff delay (1s, 2s, 4s, 8s); Clear temporary buffers | **LOCKED** |
| **UNLOCKED_ACTIVE** | `INACTIVITY_TIMEOUT` | Idle time $\ge$ user threshold (default: 300s) | Emit lock signal; Initiate memory scrubber | **LOCKED_ZEROIZING** |
| **UNLOCKED_ACTIVE** | `USER_LOCK_SHORTCUT` | User executes `Cmd + L` | Immediate synchronous dispatch to memory scrubber | **LOCKED_ZEROIZING** |
| **UNLOCKED_ACTIVE** | `SYSTEM_SLEEP` | OS notification `NSWorkspaceScreensDidSleepNotification` | Suspend pending disk writes; Emit lock signal | **LOCKED_ZEROIZING** |
| **UNLOCKED_ACTIVE** | `SCREENSAVER_START` | OS notification `com.apple.screenIsLocked` | Suspend network ingestion; Emit lock signal | **LOCKED_ZEROIZING** |
| **LOCKED_ZEROIZING**| `PURGE_COMPLETE` | All sensitive buffers zeroized; DB handles finalized | Discard VMK; Flush GPU textures; Reset UI to lock screen | **LOCKED** |

---

## 2. Ingestion State Flow & Concurrency Pipeline

Media ingestion (whether through local Wi-Fi peer-to-peer transmission or desktop file drop) follows a strict non-blocking, multi-stage processing pipeline that preserves memory security and avoids unencrypted disk persistence.

### 2.1 Ingestion Flowchart

```
[ Mobile Device (iOS / Android) ]
               │
               ▼  TLS 1.3 Transport Stream (`_photovault._tcp`)
[ Ingestion Network Worker (Rustls) ]
               │
               ▼  Stream chunks into pinned RAM ring buffer (`mlock`)
[ In-Memory Payload Assembler ]
               │
               ├────────────────────────────────────────┐
               ▼                                        ▼
[ EXIF / Metadata Parser ]                 [ Cryptographic Engine ]
  (Extract timestamps, GPS,                   (AES-256-GCM / 64KiB Chunking)
   camera model, lens parameters)                       │
               │                                        ▼
               ▼                           [ Flush Encrypted Bytes to Disk ]
[ Micro-Thumbnail & BlurHash ]               (`.aperture/data/<UUID>.aev`)
  (48x48 placeholder in memory)                         │
               │                                        │
               ▼                                        │
[ Background ANE Queue (Swift Bridge) ]                 │
  ├── VNDetectFaceRectanglesRequest                     │
  ├── VNRecognizeTextRequest (OCR)                      │
  └── MobileCLIP 768-d Vector Embedding                 │
               │                                        │
               └───────────────────┬────────────────────┘
                                   │
                                   ▼
                   [ SQLCipher Atomic Commit ]
                     ├── `media_assets`
                     ├── `face_instances`
                     ├── `asset_ocr` (FTS5)
                     └── `vec_embeddings` (`sqlite-vec`)
                                   │
                                   ▼
                   [ UI Event Bus (Tauri Channel) ]
                     └── Virtualized Grid Diff Patch (<16ms)
```

### 2.2 Pipeline Execution Stages

1. **Stage 1: Ingestion Socket & Stream Parsing:**
   - Raw bytes arrive over TLS 1.3 socket on ephemeral port.
   - Allocated memory is protected via `mlock` using a pre-allocated pinned ring buffer.
   - File magic numbers (HEIC, JPEG, PNG, ProRAW/DNG, MP4/QuickTime) are validated to prevent buffer confusion attacks.
2. **Stage 2: Metadata Extraction & Hash Derivation (In-Memory):**
   - EXIF/TIFF dictionaries are parsed directly from memory via Rust `kamadak-exif` / native `ImageIO`.
   - Timestamps, camera models, exposure data, and GPS coordinates are extracted.
   - A cryptographic BLAKE3 content digest is computed over the unencrypted payload to serve as an immutable deduplication fingerprint.
3. **Stage 3: Parallelized Storage Encryption:**
   - A unique 256-bit Asset Key is generated via `HKDF-Expand(VMK, asset_uuid)`.
   - The asset is encrypted using AES-256-GCM with a unique 96-bit IV.
   - The resulting encrypted payload is flushed atomically to the vault container directory (`.aperture/data/<asset_uuid>.aev`) via `rename(2)` to ensure zero partial-write corruption.
4. **Stage 4: Asynchronous Apple Neural Engine (ANE) Inference:**
   - The in-memory decoded image buffer is dispatched to the background Apple Silicon worker queue via Swift C-FFI:
     - **Face Worker:** Executes `VNDetectFaceRectanglesRequest` and `VNDetectFaceLandmarksRequest`. Crops detected faces and extracts 512-d normalized face vectors.
     - **OCR Worker:** Executes `VNRecognizeTextRequest`. Collects recognized character strings and text bounding boxes.
     - **Semantic Vector Worker:** Scales image to 224x224 and executes the MobileCLIP-B vision encoder on the ANE, outputting a 768-dimensional normalized unit vector.
5. **Stage 5: Encrypted Database Transaction & UI Hydration:**
   - All extracted attributes, OCR tokens, face bounding boxes, and semantic vectors are committed within a single atomic SQLCipher transaction (`BEGIN IMMEDIATE ... COMMIT`).
   - The Tauri core emits a lightweight JSON diff message to the React WebKit process containing only asset UUID, dimensions, timestamp, BlurHash, and reverse-geocoded location header.
   - The virtualized timeline updates smoothly without triggering full grid re-renders.

---

## 3. Navigation Flow & Dual-Mode Switching

The UI transitions between two complementary presentation paradigms without reloading data or dropping the memory-pinned session.

### 3.1 View Mode Topologies

```
+───────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                        APPLICATION TITLEBAR / TOOLBAR                                     |
|  [Traffic Lights]  [View Switcher: Cmd+1 / Cmd+2]    [Search Bar: Cmd+K]    [Sync Status]  [Lock: Cmd+L]  |
+───────────────────────────────────────────────────────────────────────────────────────────────────────────+
|               |                                                                                           |
|   SIDEBAR     |                               PRIMARY VIEWPORT                                            |
|               |                                                                                           |
|  Library:     |  MODE 1: GALLERY TIMELINE (Cmd+1)        MODE 2: FILE MANAGER (Cmd+2)                     |
|  • Timeline   |  +──────────────────────────────────+    +──────────────────────────────────────────────+ |
|  • Years      |  | 2024                             |    | Name         Date Modified   Size     Format | |
|  • Months     |  |   October • Kyoto, Japan         |    | ──────────────────────────────────────────── | |
|  • Days       |  |   [Img] [Img] [Img] [Img]        |    | IMG_9012.HEIC  Oct 24, 2024   2.4 MB   HEIC  | |
|               |  |                                  |    | RAW_0411.DNG   Oct 24, 2024  48.2 MB   ProRAW| |
|  Collections: |  | 2023                             |    | VID_1002.MOV   Oct 22, 2024 142.0 MB   ProRes| |
|  • People     |  |   August • Lake Tahoe            |    +──────────────────────────────────────────────+ |
|  • Places     |  |   [Img] [Img] [Img]              |    | COLLAPSIBLE EXIF INSPECTOR (Cmd+I)           | |
|  • Albums     |  +──────────────────────────────────+    | Lens: 24mm f/1.78 | ISO: 50 | Shutter: 1/2000s | |
|               |                                          | Coordinates: 35.0116° N, 135.7681° E          | |
|  Utilities:   |                                          | BLAKE3: 8f9b...a102 | AES-256-GCM Verified   | |
|  • Wi-Fi Sync |                                          +──────────────────────────────────────────────+ |
|  • Trash      |                                                                                           |
+───────────────────────────────────────────────────────────────────────────────────────────────────────────+
```

### 3.2 Navigation Hierarchy & Mode Switching Logic

1. **Gallery Timeline Mode (`Cmd + 1`):**
   - **Default Landing View:** Presents the virtualized timeline aggregated by Days.
   - **Dynamic Pinch-to-Zoom Gesture:**
     - Pinch In: Progresses zoom levels: `Years (3x3 grid) -> Months (5x5 grid) -> Days (8x8 or 10x10 grid)`.
     - Pinch Out: Expands the selected photo to a full-screen viewport with smooth shared-element layout animations.
   - **Sub-View: People & Pets (`Cmd + 3`):** Grid of clustered face chips sorted by frequency. Clicking a face opens a dedicated timeline filtered by that individual.
   - **Sub-View: Places (`Cmd + 4`):** Interactive offline vector map (MapLibre Native / offline vector tiles) displaying cluster pins based on reverse-geocoded spatial coordinates.
2. **File Manager Mode (`Cmd + 2`):**
   - **Finder-Grade Multi-Column List:** Columns for Name, Capture Date, Ingestion Date, File Size, File Type, Dimensions, Camera Make/Model, and Lens.
   - **Deep EXIF Inspector Sidebar (`Cmd + I`):**
     - Tab 1: Photographic Parameters (Shutter speed, Aperture, ISO, Focal length, Metering, Flash, White Balance, Color Space).
     - Tab 2: Geolocation & Spatial Metadata (Latitude, Longitude, Altitude, Geohash, Reverse Geocoded Address).
     - Tab 3: Security & Cryptography (Asset UUID, Storage File Name, BLAKE3 Checksum, AES-GCM Tag, Encryption Cipher Suite).
   - **Batch Action Toolbar:**
     - Strip GPS Coordinates (Rewrites metadata in memory, generates new encrypted payload).
     - Batch Rename (Pattern-based: `{date}-{camera}-{seq}`).
     - Plain Export / Encrypted Backup Container Export.
3. **State Preservation Across Transitions:**
   - Active item selections and cursor anchors are mirrored between views. If an asset is highlighted in the Timeline, switching to File Manager Mode automatically scrolls the table to focus that asset row.

---

## 4. Emergency Lock & Memory Zeroization Flow

When an emergency lock event occurs, the system executes an atomic purge sequence:

```
[ TRIGGER: Cmd+L / Inactivity / Sleep / Tamper ]
                      │
                      ▼
[ STEP 1: UI View Masking (< 1 ms) ]
  • Instantly swap React DOM viewport to opaque Blackout Mask
  • Erase cached image canvas elements from GPU VRAM
                      │
                      ▼
[ STEP 2: Network & Socket Teardown (< 2 ms) ]
  • Unbind TLS 1.3 socket server
  • Stop Bonjour mDNS advertiser
  • Drop any active mobile streaming connections
                      │
                      ▼
[ STEP 3: Database & File Handles (< 4 ms) ]
  • Issue `PRAGMA wal_checkpoint(TRUNCATE)` to SQLCipher
  • Evict decrypted page cache buffers
  • Close SQLite database handles
                      │
                      ▼
[ STEP 4: Cryptographic Zeroization (< 2 ms) ]
  • Invoke `zeroize()` on Vault Master Key (VMK)
  • Overwrite Argon2id KEK buffers with `0x00`
  • Call `munlock()` to release pinned pages
                      │
                      ▼
[ STEP 5: Final State Transition ]
  • Set FSM state = `LOCKED`
  • Display Master Password / Touch ID Login Barrier
```

Total elapsed latency for the entire zeroization sequence is guaranteed at **$< 10\text{ ms}$**.
