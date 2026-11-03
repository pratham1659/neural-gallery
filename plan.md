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
│ [ ] PHASE 3: Native Swift Acceleration Bridge (Apple Vision, Core ML ANE, Touch ID)    │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [ ] PHASE 4: Tauri 2.0 Core & Cryptographic EVFS Engine (Rust, Argon2id, SQLCipher)    │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [ ] PHASE 5: Air-Gapped P2P Wi-Fi Sync Engine (mDNS, TLS 1.3, SAS PIN, Android PWA)   │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [ ] PHASE 6: Frontend Migration to React 19 + TypeScript + Vite + TanStack Virtual     │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [ ] PHASE 7: GitHub CI/CD, DMG Packaging & Open-Source Homebrew Distribution           │
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

### [ ] Phase 3: Native Swift Acceleration Bridge (Apple Vision, Core ML ANE, Touch ID)
* **Status:** **PENDING (Next Phase)**
* **Scope & Tasks:**
  * Create Swift module compiled into `libneural_vision.dylib` with C-callable exports:
    * `neural_detect_faces`: Invokes `VNDetectFaceRectanglesRequest` (Revision 3) and `VNDetectFaceLandmarksRequest`.
    * `neural_detect_animals`: Invokes `VNRecognizeAnimalsRequest` for pet classification.
    * `neural_extract_ocr`: Invokes `VNRecognizeTextRequest` (`.accurate`) with multi-language tokenization.
    * `neural_embed_image` & `neural_embed_text`: Dispatches MobileCLIP-B model directly to the Apple Neural Engine (ANE) via Core ML (`MLComputeUnits.all`), returning 768-d unit vectors.
    * `neural_evaluate_touch_id`: Dispatches `LAContext.evaluatePolicy` to verify biometric ownership and wraps VMK with Secure Enclave key (`kSecAccessControlBiometryCurrentSet`).
  * Implement incremental DBSCAN clustering over 512-d face vectors.
* **UI Checkpoint:** CLI test runner and visual confirmation of ANE inference latency ($< 15\text{ms}$) and live face chips.

---

### [ ] Phase 4: Tauri 2.0 Core & Cryptographic EVFS Engine
* **Status:** **PENDING**
* **Scope & Tasks:**
  * Scaffold Tauri 2.0 workspace (`src-tauri`) with native Apple Silicon target.
  * Cryptographic Key Hierarchy:
    * Master Passphrase derivation via **Argon2id** ($m=64\text{ MiB}, t=3, p=4$) yielding 256-bit KEK.
    * Secure memory allocation: Wrap keys and decrypted buffers in `zeroize::ZeroizeOnDrop` and pin pages using `libc::mlock`.
  * Encrypted Virtual File System (EVFS):
    * Streaming chunked encryptor/decryptor using **AES-256-GCM** (and XChaCha20-Poly1305 for large videos $>100\text{MB}$) into `.aev` blocks.
    * Zero unencrypted bytes written to disk or swap space.
  * Encrypted Database Engine:
    * Statically link SQLCipher 4.6+ with WAL mode and memory PRAGMAs (`temp_store = MEMORY`).
    * Link `sqlite-vec` extension for in-memory cosine similarity search over 768-d MobileCLIP embeddings.
    * Link SQLite FTS5 for OCR token search.
  * Panic Lockdown Trigger:
    * Map `Cmd+L`, display sleep (`NSWorkspaceScreensDidSleepNotification`), and idle timer to wipe keys and drop to lock barrier in $< 10\text{ms}$.
* **UI Checkpoint:** Desktop application window unlocks with master password / Touch ID and shows Argon2id progress animation.

---

### [ ] Phase 5: Air-Gapped Peer-to-Peer Wi-Fi Ingestion Engine
* **Status:** **PENDING**
* **Scope & Tasks:**
  * **Bonjour / mDNS Daemon:**
    * Broadcast `_photovault._tcp.local.` using native network APIs.
    * Advertise TXT records: `v=1`, `id=<vault_uuid>`, `fp=<cert_fingerprint>`, `auth=sas6`.
  * **Ephemeral TLS 1.3 Socket Server:**
    * Generate ephemeral in-memory self-signed X.509 certificate and private key valid for 24 hours.
    * Enforce TLS 1.3 ciphers (`TLS_AES_256_GCM_SHA384` and `TLS_CHACHA20_POLY1305_SHA256`) via Rust `rustls`.
    * Bind dynamically to an unassigned ephemeral port (`0.0.0.0:0`).
  * **Out-of-Band SAS Pairing Protocol:**
    * Extract TLS 1.3 `ExporterMasterSecret` and derive 6-digit numeric Short Authentication String (SAS).
    * Display pairing PIN on the macOS desktop screen for mobile verification.
  * **Multi-Platform Ingestion Streams:**
    * Stream incoming media chunks directly into pinned `mlock` ring buffers in RAM.
    * Parse EXIF, compute BLAKE3 digest, encrypt via AES-256-GCM, and commit to `.aev` block.
    * Serve lightweight local PWA assets over the TLS socket for zero-install Android browser uploads via QR code.
* **UI Checkpoint:** The P2P Wi-Fi Sync drawer in the left bottom corner displays active mDNS status, nearby devices, and interactive SAS PIN pairing modal.

---

### [ ] Phase 6: Frontend Migration to React 19 + TypeScript + Vite + TanStack Virtual
* **Status:** **PENDING**
* **Scope & Tasks:**
  * Port the design system and components from `preview.html` into a modular React 19 + TypeScript + Vite project:
    * `src/components/timeline/`: Multi-tier virtualized grid (Years $\leftrightarrow$ Months $\leftrightarrow$ Days) with TanStack Virtual.
    * `src/components/explorer/`: Finder-grade multi-column table with deep EXIF/IPTC inspector sidebar (`⌘I`) and duplicate comparison.
    * `src/components/map/`: Interactive Places & Geography map with geocache pins.
    * `src/components/people/`: People & Pets face carousel with circular face chips and candidate confirmation banner.
    * `src/components/auth/`: Touch ID and Master Password lock screen modal (`⌘L`).
    * `src/components/sync/`: P2P Wi-Fi Sync modal and QR code generator for Android PWA pairing.
  * Stream decrypted images to the WebKit canvas via memory-backed custom protocol (`aperture-stream://`) or ephemeral object URLs without disk staging.
* **UI Checkpoint:** Full native desktop application executing at steady 60–120 fps ProMotion refresh rate with fluid pinch-to-zoom timeline transitions.

---

### [ ] Phase 7: GitHub CI/CD, Packaging & Open-Source Distribution
* **Status:** **PENDING**
* **Scope & Tasks:**
  * **Automated GitHub Actions (`.github/workflows/release.yml`):**
    * Triggered on version tag push (`git tag v1.0.0 && git push --tags`).
    * Executes on Apple Silicon runner (`macos-14` M1).
    * Compiles Swift bridge, builds Rust core with SQLCipher, bundles React 19 assets, and produces signed `.app` and `.dmg`.
  * **Ad-Hoc Signing & Gatekeeper Documentation:**
    * Configure ad-hoc code signing (`codesign --force --deep --sign -`).
    * Include visual drag-and-drop `.dmg` background and clear quarantine bypass instructions (`xattr -cr`).
  * **Community Homebrew Cask:**
    * Create Homebrew formula for one-command installation:
      ```bash
      brew install --cask neural-gallery
      ```
* **UI Checkpoint:** Downloadable, drag-and-drop `.dmg` available on GitHub Releases that opens seamlessly on any Apple Silicon Mac.

---

## 5. Security & Contribution Guidelines

1. **Strict PR Workflow:** Never push directly to `main`. Every phase must be developed on a dedicated feature branch (e.g. `feat/phase-X-description`), verified with tests, and merged via GitHub Pull Request (`gh pr create`).
2. **README Synchronization:** Keep [`README.md`](README.md) continuously updated with all new commands, features, and API endpoints as each phase completes.
3. **No Unencrypted Disk Swaps:** Decrypted frame buffers, cryptographic keys, and thumbnails must never be written to `/tmp` or standard cache directories.
4. **Zero Cloud Egress:** All network activity is restricted to local subnet peer-to-peer sync (`_photovault._tcp.local.`). Zero analytics, zero cloud relays, and zero telemetry.
