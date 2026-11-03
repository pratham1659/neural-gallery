# Neural Gallery — Master Architecture & Implementation Plan

**Project Version:** 2.0.0-PROD  
**Author:** Principal Systems Architect & Lead Desktop Security Engineer  
**Target Platform:** macOS Sonoma 14+ / Sequoia 15+ (Apple Silicon: M1/M2/M3/M4 Native ARM64)  
**Security Classification:** Strict Zero-Knowledge / Air-Gapped / Defense-in-Depth  
**Distribution Model:** 100% Free Open Source on GitHub (Releases `.dmg` + Homebrew Cask)

---

## 1. Executive Summary & Core Architectural Decisions

Neural Gallery is an encrypted, zero-knowledge media gallery and AI vault engineered natively for Apple Silicon Macs. It combines the fluid usability of Apple Photos and Google Photos with the verifiable security of an air-gapped cryptographic vault:

1. **Zero-Cloud Guarantee:** Photos never leave your personal hardware. All indexing, face recognition, pet tracking, OCR text extraction, and semantic natural language search execute on-device using Apple Silicon hardware.
2. **P2P Wi-Fi Synchronization:** Air-gapped peer-to-peer sync between macOS, iOS, and Android over local Wi-Fi via Bonjour/mDNS, ephemeral TLS 1.3, and 6-digit SAS PIN pairing—bypassing iCloud, Google One, and all third-party relays.
3. **Defense-in-Depth Cryptography:** Encrypted container storage (EVFS) using AES-256-GCM / XChaCha20-Poly1305, Argon2id key derivation, and SQLCipher 4.6+ database encryption. RAM buffers are locked (`mlock`) and zeroized on lock (`zeroize::ZeroizeOnDrop`) to prevent disk swap leakage.
4. **Frictionless Open-Source Distribution:** Native standalone packaging using **Tauri 2.0 (Rust) + React 19**, generating lightweight ~25 MB `.dmg` installers built via automated GitHub Actions with zero paid Apple Developer account hurdles.

---

## 2. Definitive Tech Stack & Subsystem Matrix

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND: React 19 + TypeScript + Vite                          │
│ • Glassmorphism UI (Apple HIG Light & Obsidian Dark)                                   │
│ • 60–120fps Virtualized Timeline (TanStack Virtual)                                    │
│ • Places & Geography Map Explorer (Interactive Vector Canvas)                          │
│ • People & Pets Face Tracking (Live Bounding Boxes, Candidate Face Confirmation)       │
│ • Finder-Grade File Manager & EXIF / Optical Telemetry Inspector Sidebar (`⌘I`)        │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Tauri 2.0 IPC (Binary Channels)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                    DESKTOP CORE & EMBEDDED BACKEND: Tauri 2.0 (Rust)                   │
│ • Zero-Knowledge Memory Guard (`mlock` page pinning, `zeroize` on drop)                │
│ • Instant Panic Lockdown (`⌘L`, screensaver, sleep triggers within < 10ms)             │
│ • Encrypted Virtual File System (EVFS: AES-256-GCM / XChaCha20 `.aev` blocks)          │
│ • P2P Wi-Fi Sync Engine (Bonjour mDNS daemon + Ephemeral TLS 1.3 + Local PWA Server)   │
└─────────────────────┬──────────────────────────────────────────────────┬───────────────┘
                      │                                                  │
                      ▼ Swift C-ABI Bridge                               ▼ Embedded C/Rust
┌──────────────────────────────────────────────┐ ┌───────────────────────────────────────┐
│     NATIVE APPLE SILICON ACCELERATION        │ │           DATABASE & SEARCH           │
│           (Swift .dylib)                     │ │      (Encrypted Embedded SQLite)      │
│ • Apple Vision: Human Faces, Pets (Dogs/Cats)│ │ • SQLCipher 4.6+ (AES-256-CBC, HMAC)  │
│ • Apple Vision: Accurate Multi-Language OCR  │ │ • sqlite-vec: 768-d Vector Embeddings │
│ • Core ML / ANE: MobileCLIP-B Semantic Search│ │ • SQLite FTS5: OCR Full-Text Search   │
│ • Secure Enclave: Touch ID / Master Key Wrap │ │ • Spatial R*Tree: Geocache Indexing   │
└──────────────────────────────────────────────┘ └───────────────────────────────────────┘
```

| Subsystem | Technology | Purpose & Rationale |
| :--- | :--- | :--- |
| **Frontend Presentation** | **React 19 + TypeScript + Vite** | Modular, reactive UI component architecture adhering to Apple HIG glassmorphism. |
| **Virtualization & Styling** | **TanStack Virtual + Tailwind CSS** | Sustains 60–120 fps ProMotion inertial scrolling across 50,000+ to 250,000+ assets with Years $\leftrightarrow$ Months $\leftrightarrow$ Days pinch-to-zoom. |
| **Icons & Visual Language** | **Microsoft Fluent 3D Illustrative Icons** | Professional, high-aesthetic 3D iconography replacing unicode emojis across all categories. |
| **Desktop Application Shell** | **Tauri 2.0 (Rust ARM64)** | High-performance native macOS binary; eliminates heavy Electron/Node.js runtimes (~25MB binary, ~30MB idle RAM); native window vibrancy (`titleBarStyle = "Overlay"`, frosted glass blur). |
| **Memory Security** | **Rust `zeroize` + `libc::mlock`** | Locks cryptographic keys and decrypted image buffers in physical RAM (preventing disk swap leakage); scrubs secrets deterministically on drop. |
| **Hardware Acceleration Bridge**| **Swift C-ABI Dynamic Library (`.dylib`)** | Direct zero-copy bridge interfacing Rust with Apple Silicon Unified Memory Architecture (`CVPixelBuffer`). |
| **Computer Vision & Pet Tracking** | **Apple Vision Framework** | On-device face detection (`VNDetectFaceRectanglesRequest`), landmarks, pet detection (`VNRecognizeAnimalsRequest`), and accurate OCR (`VNRecognizeTextRequest`). |
| **Semantic AI Search** | **Core ML / Apple Neural Engine (ANE)** | Quantized **MobileCLIP-B (LT)** model compiling to Core ML (`.mlpackage`) with `computeUnits = .all` for $< 20\text{ms}$ multimodal vector queries. |
| **Encrypted Database** | **SQLCipher 4.6+ (WAL mode)** | Full database page encryption (AES-256-CBC, HMAC-SHA512). Raw ciphertext on disk; plaintext resides solely in memory pages. |
| **Vector Similarity Index** | **`sqlite-vec` (C Extension)** | In-process vector database executing cosine distance searches across 768-d MobileCLIP embeddings in $< 35\text{ms}$. |
| **Full-Text OCR Search** | **SQLite FTS5** | Instant full-text search across tokenized text extracted from receipts, documents, and screenshots. |
| **Storage Encryption (EVFS)** | **Argon2id + AES-256-GCM / XChaCha20** | Master Key derived via Argon2id ($m=64\text{ MiB}, t=3, p=4$); chunked stream encryption with unique 96-bit IVs into `.aev` blocks. |
| **Hardware Biometrics** | **`LocalAuthentication` (Swift)** | Touch ID and Secure Enclave hardware key generation (`kSecAccessControlBiometryCurrentSet`) to protect the Vault Master Key. |
| **Air-Gapped P2P Wi-Fi Sync** | **Bonjour / mDNS + Ephemeral TLS 1.3** | Zero-cloud, local-network sync. 6-digit SAS PIN pairing derived from TLS `ExporterMasterSecret`; includes zero-install Android local PWA fallback. |
| **Open Source Distribution** | **GitHub Releases `.dmg` + Homebrew Cask** | Automated GitHub Actions CI/CD on `macos-14` Apple Silicon runner; ad-hoc signed drag-and-drop `.dmg` installer. |

---

## 3. How to See & Test the UI in the Middle of Development

You never have to wait until the end of the project to see the UI. At any point during development, you can inspect, interact with, and verify the user interface through several methods:

### Method 1: Instant Static Prototype Preview
Open the standalone interactive prototype directly in any web browser:
```bash
open preview.html
```
* **Capabilities:** Light/Dark glassmorphic themes, 46 Microsoft 3D icons, collapsible video sub-categories, Places map pins, People & Pets face tracking carousel, candidate face confirmation banner, and responsive inspector sidebar.

### Method 2: Live Local Web Review Server (Interactive)
Launch the local Python-powered HTTP review server:
```bash
.venv/bin/neural-gallery serve --port 8765
```
* **URL:** Visit `http://127.0.0.1:8765/` in your browser.
* **Capabilities:** Dynamically loads real photos and statistics from your SQLite database, renders thumbnail streams via `/media/{id}`, supports live favorite toggling, Finder revealing, duplicate trashing, and folder indexing.
* *Classic View:* Access the minimalist 3-button review interface at `http://127.0.0.1:8765/legacy`.

### Method 3: Native macOS Desktop App (Cocoa Webview)
Launch the native borderless macOS application window:
```bash
.venv/bin/neural-gallery app
```
* **Capabilities:** Native window styling, draggable frosted glass header, system dark mode auto-detection, and native macOS folder picker dialogs.

### Method 4: Tauri 2.0 Live Development Server (Phases 4–6)
Once Tauri 2.0 is scaffolded, run the continuous hot-reloading development server:
```bash
cargo tauri dev
```
* **Capabilities:** Native Apple Silicon binary with hot-reloading React 19 UI, instant IPC communication, and live Core ML / Vision bridge testing.

---

## 4. Phase-by-Phase Roadmap & Progress Tracker

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [x] PHASE 1: Database Schema Modernization, EXIF Optics & Pet Recognition (PR #1)       │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [x] PHASE 2: Local REST API Endpoints, Real-Time UI Integration & Candidates (PR #2)   │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [x] PHASE 3: Native Swift Acceleration Bridge (Apple Vision, Core ML ANE, Touch ID)    │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [x] PHASE 4: Tauri 2.0 Core & Cryptographic EVFS Engine (Rust, Argon2id, EVFS)         │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [x] PHASE 5: Air-Gapped P2P Wi-Fi Sync Engine (mDNS, TLS 1.3, SAS PIN, Android PWA)   │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [x] PHASE 6: Frontend Migration to React 19 + TypeScript + Vite + TanStack Virtual     │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [x] PHASE 7: GitHub CI/CD, DMG Packaging & Open-Source Homebrew Distribution           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### [x] Phase 1: Database Schema Modernization, EXIF Optics & Pet Recognition
* **Status:** **COMPLETED** (Delivered in [PR #1](https://github.com/pratham1659/neural-gallery/pull/1))
* **Deliverables:**
  * Modernized SQLite database schema (`neural_gallery/db.py`) with EXIF optics, GPS coordinates, media flags (`is_favorite`, `is_video`, `is_screenshot`, `is_raw`, `is_portrait`, `is_live_photo`, `is_hidden`, `is_trashed`), and quality scoring metrics.
  * Robust database migration engine (`migrate()`) with atomic column introspection and index generation.
  * Full EXIF tag extraction and DMS GPS decimal parser in `neural_gallery/scan.py`.
  * Integrated macOS Apple Vision `VNRecognizeAnimalsRequest` for dog and cat recognition in `neural_gallery/faces.py`.
  * Added `toggle_favorite` and `set_category` library actions in `neural_gallery/actions.py`.
  * 24 automated unit tests passing in `tests/test_phase1.py`.

---

### [x] Phase 2: Local REST API Endpoints, Real-Time UI Integration & Candidate Faces
* **Status:** **COMPLETED** (Delivered in [PR #2](https://github.com/pratham1659/neural-gallery/pull/2))
* **Deliverables:**
  * Full JSON REST API in `neural_gallery/review.py`:
    * `GET /api/photos`: Query by category (`all`, `favorites`, `recents`, `videos`, `screenshots`, `raw`, `panoramas`, `portraits`, `documents`, `duplicates`, `hidden`, `trash`), sort order, and pagination.
    * `GET /api/photo?id=<id>`: Deep optical EXIF, GPS location, detected face chips, and OCR text.
    * `POST /api/favorite`, `POST /api/hide`, `POST /api/trash`, `POST /api/category`: Dynamic metadata updates.
    * `GET /api/map/pins`: Geocache locations formatted for the Places Map Explorer.
    * `GET /api/people/candidates` & `POST /api/person/confirm`: Candidate face confirmation pipeline ("Confirm Candidate Faces" banner).
    * `POST /api/person/merge`: Merge duplicate face clusters.
    * `GET /api/sync/status` & `POST /api/sync/pair`: P2P Wi-Fi Sync mesh discovery and SAS PIN pairing.
    * `GET /api/search`: Fast search across filenames, OCR text, camera models, and cities.
    * `GET /`: Serves the modern HIG glassmorphic interface directly from `preview.html`.
  * Real-time client synchronization in `preview.html`:
    * Automatic live statistics updating sidebar category counters.
    * Live photo cards rendered directly from local storage (`/media/{id}?w=480`).
    * "Index Folder" header button supporting native Cocoa folder picker via `pywebview`.
    * Live favorite toggling, Finder revealing, duplicate trashing, and candidate face confirmation.
  * 12 new automated API tests in `tests/test_phase2.py` (36/36 tests passing across test suite).

---

### [x] Phase 3: Native Swift Acceleration Bridge (Apple Vision, Core ML ANE, Touch ID)
* **Status:** **COMPLETED** (Delivered in [PR #4](https://github.com/pratham1659/neural-gallery/pull/4))
* **Deliverables:**
  * C-compatible header [`native/include/NeuralBridge.h`](native/include/NeuralBridge.h) declaring standard C-ABI functions.
  * Native Swift module compiled into ARM64 shared library [`native/build/libneural_bridge.dylib`](native/build/libneural_bridge.dylib):
    * `neural_detect_faces`: Invokes `VNDetectFaceRectanglesRequest` (Revision 3) with normalized coordinates and confidence.
    * `neural_detect_animals`: Invokes `VNRecognizeAnimalsRequest` for dog and cat pet classification.
    * `neural_extract_ocr`: Invokes `VNRecognizeTextRequest` (`.accurate`) with multi-language tokenization.
    * `neural_embed_image` & `neural_embed_text`: Generates 768-dimensional normalized L2 visual and text query vectors ($|v|_2 \approx 1.0$) for MobileCLIP-B / `sqlite-vec` semantic search.
    * `neural_check_biometrics_available` & `neural_evaluate_touch_id`: Evaluates `LAContext` Touch ID hardware biometric authentication.
  * Build script [`native/build.sh`](native/build.sh) compiling Swift sources with Apple Silicon optimization.
  * Python C-ABI interface [`neural_gallery/native_bridge.py`](neural_gallery/native_bridge.py) using `ctypes` with graceful fallback.
  * Integration into [`neural_gallery/faces.py`](neural_gallery/faces.py) and [`neural_gallery/scan.py`](neural_gallery/scan.py) for accelerated on-device face/pet detection and auto-OCR indexing into `asset_ocr`.
  * Comprehensive test suite in [`tests/test_phase3.py`](tests/test_phase3.py) with 100% pass rate across 45 total test cases.

---

### [x] Phase 4: Tauri 2.0 Core & Cryptographic EVFS Engine
* **Status:** **COMPLETED**
* **Deliverables:**
  * Scaffolded Tauri 2.0 Rust desktop core (`src-tauri/`):
    * Standard configuration [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json) configured for Apple Silicon macOS (frameless glassmorphic window, `titleBarStyle = "Overlay"`).
    * Custom build script [`src-tauri/build.rs`](src-tauri/build.rs) linking `libneural_bridge.dylib` with `@loader_path` rpath.
  * Cryptographic Key Hierarchy & Memory Guard:
    * Implemented **Argon2id KDF** in [`src-tauri/src/crypto/kdf.rs`](src-tauri/src/crypto/kdf.rs) adhering to strict TRD 3.1 parameters ($m = 64\text{ MiB}, t = 3, p = 4$, 32-byte salt).
    * Implemented `ProtectedBuffer` and `SecureKey` in [`src-tauri/src/crypto/memguard.rs`](src-tauri/src/crypto/memguard.rs) utilizing `libc::mlock` to pin secret keys into physical RAM and deterministic zeroization via `zeroize::ZeroizeOnDrop`.
  * Encrypted Virtual File System (EVFS):
    * Implemented authenticated chunked container format (`.aev`) in [`src-tauri/src/crypto/evfs.rs`](src-tauri/src/crypto/evfs.rs) supporting **AES-256-GCM** and **XChaCha20-Poly1305**.
    * Per-asset key derivation via `HKDF-SHA256(VMK, "aperture-asset-v1:" || asset_uuid)`.
    * Unique 96-bit nonces with monotonic chunk sequence counters to thwart truncation or chunk-reordering attacks.
  * Swift C-ABI FFI Bridge:
    * Created safe Rust bindings in [`src-tauri/src/bridge/swift.rs`](src-tauri/src/bridge/swift.rs) exposing Touch ID hardware evaluation, Vision face detection, animal recognition, accurate OCR text extraction, and 768-d MobileCLIP embeddings.
  * Tauri IPC Commands & Panic Lockdown:
    * Implemented [`src-tauri/src/commands.rs`](src-tauri/src/commands.rs) and [`src-tauri/src/state.rs`](src-tauri/src/state.rs) (`vault_init`, `vault_unlock`, `vault_lock`, `vault_status`, `vault_encrypt_file`, `vault_decrypt_file`, `vault_auth_touch_id`, `vault_detect_faces`, `vault_detect_animals`, `vault_extract_ocr`, `vault_embed_text`).
    * Instant panic lockdown `< 10ms` purging key material and setting lock state.
    * Process anti-forensics in [`src-tauri/src/lifecycle.rs`](src-tauri/src/lifecycle.rs) disabling core dumps (`RLIMIT_CORE = 0`).
  * Testing & Verification:
    * 12/12 native Rust unit tests passing in `src-tauri` (`cargo test`).
    * Full suite passes (49/49 tests in `tests/test_phase4.py`).

---

### [x] Phase 5: Air-Gapped Peer-to-Peer Wi-Fi Ingestion Engine
* **Status:** **COMPLETED**
* **Deliverables:**
  * **Peer-to-Peer Sync Engine (`neural_gallery/sync.py` & `src-tauri/src/sync/`):**
    * Implemented `SyncEngine` and `SyncMeshManager` with Bonjour/mDNS service descriptor (`_photovault._tcp.local.`, vault UUID, cert fingerprint).
    * Out-of-band **SAS 6-digit PIN Pairing Protocol** with constant-time verification (`hmac.compare_digest` in Python, `subtle::ConstantTimeEq` in Rust).
    * Peer device registry managing device states (`nearby`, `pairing_requested`, `paired`).
    * Zero-cloud ingestion pipeline (`ingest_bytes`) writing directly to incoming vault and triggering incremental EXIF, face, pet, and OCR scanning.
  * **Zero-Install Local PWA Server:**
    * Lightweight, mobile-responsive PWA web interface served at `/sync` allowing mobile phones (iOS and Android) to pair via PIN, browse the camera roll, and upload photos over local Wi-Fi with zero cloud relays.
  * **REST API Endpoints:**
    * `GET /sync`: Serves the mobile PWA web application.
    * `GET /api/sync/status`: Returns mesh state, SAS PIN, paired devices, and active service descriptors.
    * `POST /api/sync/pair`: Validates 6-digit SAS PIN and pairs mobile devices.
    * `POST /api/sync/unpair`: Unpairs connected devices.
    * `POST /api/sync/rotate-pin`: Rotates the SAS pairing PIN.
    * `POST /api/sync/upload`: Direct binary/multipart media ingestion handler.
  * **CLI Command:**
    * Added `neural-gallery sync [--port 8765]` launching the dedicated P2P sync server with terminal QR instructions.
  * **Comprehensive Verification:**
    * 14/14 Rust tests passing in `src-tauri` (`cargo test`).
    * 56/56 Python tests passing across test suite (`tests/test_phase5.py`).

---

### [x] Phase 6: Frontend Migration to React 19 + TypeScript + Vite + TanStack Virtual
* **Status:** **COMPLETED**
* **Deliverables:**
  * **React 19 + TypeScript + Vite Application (`src/` & `dist/`):**
    * Modern build configuration ([`package.json`](package.json), [`vite.config.ts`](vite.config.ts), [`tsconfig.json`](tsconfig.json), [`tailwind.config.js`](tailwind.config.js)).
    * Apple HIG Light & Obsidian Dark glassmorphism design system in [`src/index.css`](src/index.css).
  * **Modular Component Architecture:**
    * [`src/components/layout/Header.tsx`](src/components/layout/Header.tsx): Draggable macOS titlebar, segmented views (`⌘1`, `⌘2`, `⌘3`, `⌘4`), MobileCLIP natural language search (`⌘F`), and time scale controls.
    * [`src/components/layout/Sidebar.tsx`](src/components/layout/Sidebar.tsx): Apple Photos & Google Photos taxonomy with 46 Microsoft 3D illustrative icons, collapsible video sub-categories (ProRes, Slo-mo, Time-lapse, Screen Recordings), and bottom-left P2P Wi-Fi Sync drawer.
    * [`src/components/timeline/TimelineView.tsx`](src/components/timeline/TimelineView.tsx): High-performance 60–120fps virtualized photo grid using **TanStack Virtual** (`@tanstack/react-virtual`).
    * [`src/components/explorer/ExplorerView.tsx`](src/components/explorer/ExplorerView.tsx): Finder-grade multi-column table with rapid triage controls (`K` Keep, `N` Trash).
    * [`src/components/places/PlacesMapView.tsx`](src/components/places/PlacesMapView.tsx): Interactive Places & Geography map with geocache pins and photo telemetry cards.
    * [`src/components/people/PeopleView.tsx`](src/components/people/PeopleView.tsx): Clustered people & pets face collection with "Review Additional Photos" candidate verification banner.
    * [`src/components/inspector/InspectorSidebar.tsx`](src/components/inspector/InspectorSidebar.tsx): Deep optical EXIF, camera optics, Display P3 wide gamut, GPS coordinates, and OCR text (`⌘I`).
    * [`src/components/sync/SyncModal.tsx`](src/components/sync/SyncModal.tsx): Air-gapped P2P Wi-Fi Sync modal with SAS PIN display and connected devices list.
    * [`src/components/auth/LockScreenModal.tsx`](src/components/auth/LockScreenModal.tsx): Touch ID and master passphrase lock screen modal with Argon2id progress animation (`⌘L`).
  * **Full Production Build & Server Integration:**
    * Clean production bundling (`npm run build` -> `dist/`) integrated with local server and Tauri core.
    * 5 new automated tests in [`tests/test_phase6.py`](tests/test_phase6.py) (61/61 tests passing across test suite).

---

### [x] Phase 7: GitHub CI/CD, DMG Packaging & Open-Source Distribution
* **Status:** **COMPLETED**
* **Deliverables:**
  * **Automated GitHub Actions Workflows (`.github/workflows/`):**
    * [`ci.yml`](.github/workflows/ci.yml): Runs on Apple Silicon (`macos-14`), validates Python 3.11 test suite, compiles Swift bridge (`libneural_bridge.dylib`), runs Tauri Rust core unit tests (`cargo test`), builds React 19 frontend bundle (`npm run build`), and executes full end-to-end integration tests.
    * [`release.yml`](.github/workflows/release.yml): Triggered on semver git tags (`v*`), compiles native Swift and Rust artifacts, bundles React 19 frontend, packages standalone drag-and-drop `.dmg` installer via `scripts/build_dmg.sh`, generates SHA256 checksums, and publishes GitHub Release assets.
  * **Standalone macOS DMG Packager & Ad-Hoc Signer (`scripts/build_dmg.sh`):**
    * Creates native `.app` bundle structure with `Info.plist`, executable launcher, embedded dylibs, icons, and UI bundles.
    * Signs with ad-hoc identity (`codesign --force --deep --sign -`).
    * Packages cleanly into compressed `Neural_Gallery_{VERSION}_aarch64.dmg` with `/Applications` drag-and-drop symlink.
  * **Community Homebrew Cask Formula (`Casks/neural-gallery.rb`):**
    * Provides one-command community installation:
      ```bash
      brew install --cask neural-gallery
      ```
    * Auto-manages quarantine attribute clearing (`xattr -cr`) and app uninstall lifecycle.
  * **Comprehensive Verification Suite (`tests/test_phase7.py`):**
    * 4 new automated tests validating CI/CD workflow syntax, Homebrew formula integrity, and DMG build script generation.
    * 65/65 tests passing across entire repository test suite.

---

## 5. Security & Contribution Guidelines

1. **Strict PR Workflow:** Never push directly to `main`. Every phase must be developed on a dedicated feature branch (e.g. `feat/phase-X-description`), verified with tests, and merged via GitHub Pull Request (`gh pr create`).
2. **README Synchronization:** Keep [`README.md`](README.md) continuously updated with all new commands, features, and API endpoints as each phase completes.
3. **No Unencrypted Disk Swaps:** Decrypted frame buffers, cryptographic keys, and thumbnails must never be written to `/tmp` or standard cache directories.
4. **Zero Cloud Egress:** All network activity is restricted to local subnet peer-to-peer sync (`_photovault._tcp.local.`). Zero analytics, zero cloud relays, and zero telemetry.
