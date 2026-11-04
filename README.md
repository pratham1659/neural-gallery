# Neural Gallery

An encrypted, zero-knowledge local photo gallery and AI vault for Apple Silicon macOS.

Neural Gallery indexes media stored on your Mac, performs on-device face & pet recognition, extracts optical EXIF and GPS geography, clusters near-duplicates, and provides high-speed photo triage with zero cloud telemetry.

> **Interactive UI Prototype:** Open [`preview.html`](preview.html) in any browser to explore the full Apple Photos & Google Photos-inspired gallery with Microsoft 3D illustrative icons, Places Map, Face Tracking, and P2P Wi-Fi Sync.

---

## Key Features

* **Apple & Android Photos Native Taxonomy:**
  * **Library:** All Photos, Favorites, Recents.
  * **Sharing:** Shared Albums, Shared with You (AirDrop/Messages), and Partner Sharing.
  * **People, Pets & Travel:** On-device face collection, pet recognition (dogs & cats via Apple Vision), and travel trip albums.
  * **Media Types:** Videos (4K ProRes, Slo-mo 240fps, Time-lapse, Screen Recordings), Screenshots, Selfies, Portraits (Depth), Live Photos, Apple ProRAW / DNG, Panoramas, and Receipts & Documents (OCR).
  * **Utilities:** Duplicates (dhash perceptual clustering), To sort (Inbox), Receipts, Hidden Vault, Imports, and Low Quality Triage.
* **People & Pets Face Tracking:**
  * Collects and clusters human faces and pets 100% locally on your Mac using Apple Vision CoreML embeddings.
  * Interactive **"Review Additional Photos"** candidate verification banner (just like Apple Photos).
  * Live **Face Focus Bounding Boxes** (`[Eleanor 99.4%]`, `[Sarah 98.9%]`, `[Milo (Dog) 98.7%]`).
* **Geography & Places Map Explorer (`Cmd+3`):**
  * Interactive vector map canvas with dark/light theme support.
  * Interactive location pins across Tokyo, San Francisco, Yosemite, Dolomites, and Kyoto.
  * Comprehensive Photo Telemetry Inspector showing reverse-geocoded addresses, coordinates (`35.6764° N, 139.6500° E`), altitude, camera optics (`ƒ/2.8 · 1/1000s · ISO 100`), lens, and Display P3 wide gamut.
* **P2P Local Wi-Fi Mesh Sync (`_photovault._tcp.local`):**
  * Positioned in the left bottom corner of the sidebar above Trash.
  * Air-gapped device-to-device local Wi-Fi synchronization between macOS and mobile devices with zero external cloud egress.
* **Non-Destructive by Design:**
  * Photo triage never executes permanent delete syscalls (`unlink`). All discards route safely to the macOS **Finder Trash** (`~/.Trash`).
* **Hardware Enclave & Touch ID Ready:**
  * Biometric master password & Touch ID / Face ID lock simulation (`Cmd+L`).

---

## Architecture & Native Acceleration

Neural Gallery utilizes a hybrid high-performance architecture:
* **Native Swift Dynamic Library (`libneural_bridge.dylib`):** Direct C-ABI bridge exposing macOS `Vision.framework` (`VNDetectFaceRectanglesRequest`, `VNRecognizeAnimalsRequest`, `VNRecognizeTextRequest`), Core ML MobileCLIP image/text embeddings, and `LocalAuthentication.framework` (Touch ID / Face ID hardware validation).
* **Python Engine & CLI:** Orchestrates file discovery, metadata parsing, perceptual hash clustering, SQLite storage, and serves the REST API.
* **Tauri 2.0 & High-Performance UI:** Provides hardware-accelerated rendering and encrypted vault filesystem access.

### Compiling the Native Swift Bridge

```bash
# Build libneural_bridge.dylib for Apple Silicon
./native/build.sh
```

### Tauri 2.0 Core & Cryptographic Engine

```bash
# Run Rust unit tests for Argon2id KDF, EVFS AES-256-GCM, and memory guard
cd src-tauri && cargo test
```

### React 19 + TypeScript + Vite Desktop Frontend

```bash
# Install dependencies
npm install

# Start Vite live development server (HMR on port 1420)
npm run dev

# Build production bundle
npm run build
```

---

## Installation & Packaging

### Method 1: Homebrew Cask (Recommended)

Install Neural Gallery natively on Apple Silicon macOS via Homebrew:

```bash
brew install --cask Casks/neural-gallery.rb
# Or once tapped:
# brew install --cask neural-gallery
```

### Method 2: GitHub Releases (.dmg)

1. Download the latest `Neural_Gallery_2.0.0_aarch64.dmg` from [GitHub Releases](https://github.com/pratham1659/neural-gallery/releases).
2. Double-click the `.dmg` and drag **Neural Gallery** into your `/Applications` folder.
3. *Note on Open-Source Distribution:* Because Neural Gallery is 100% free open-source software built with ad-hoc signing, macOS Gatekeeper may flag it on first launch. To permit launch, run:
   ```bash
   xattr -cr "/Applications/Neural Gallery.app"
   ```
   Or right-click the app in Finder and choose **Open**.

### Method 3: Build Standalone DMG from Source

You can build the native ARM64 `.app` and `.dmg` locally:

```bash
# Build the native Swift bridge and frontend assets, then assemble the DMG
./scripts/build_dmg.sh

# The resulting installer is generated at:
# dist-dmg/Neural_Gallery_2.0.0_aarch64.dmg
```

---

## Continuous Integration & Release Automation

Neural Gallery employs automated GitHub Actions workflows running on Apple Silicon (`macos-14` M1):
* **CI Workflow (`.github/workflows/ci.yml`):** Automatically tests every Pull Request and branch push across Python 3.11, Swift dynamic bridge compilation, Rust Tauri core unit tests, Vite bundle build, and the full 65-test integration suite.
* **Release Workflow (`.github/workflows/release.yml`):** Automatically triggered on version tags (`v*`), compiles native binaries, packages the `.dmg`, computes SHA-256 checksums, and publishes GitHub Release assets.

---

## Quickstart

### Requirements
* macOS 12 Monterey or newer (optimized for Apple Silicon M-series).
* Python 3.11 or newer.

```bash
# Set up virtual environment
python3 -m venv .venv
source .venv/bin/activate
pip install -e .

# Scan any folder of photos and videos (read-only)
neural-gallery scan ~/Pictures

# View rich library statistics
neural-gallery stats

# Run on-device Apple Vision face & pet grouping
neural-gallery faces

# Launch native desktop window
neural-gallery app

# Or open in web browser
neural-gallery serve
```

---

## 🚀 Running the Server & Testing the Application

Neural Gallery consists of a Python Core API backend and a React 19 + TypeScript frontend. You can run and test both components simultaneously:

### 1. Start the Servers

In separate terminal windows or background processes:

```bash
# Terminal 1: Start Python Core Backend & REST API (Port 8765)
source .venv/bin/activate
neural-gallery serve
# Or directly via module:
./.venv/bin/python -m neural_gallery.cli serve

# Terminal 2: Start React Frontend with Hot Module Replacement (Port 1420)
npm run dev
```

### 2. Active Endpoints & Access URLs

| Component | Port | Local URL | Description |
| :--- | :--- | :--- | :--- |
| **Vite Dev Server (HMR)** | `1420` | [http://localhost:1420/](http://localhost:1420/) | Active development frontend with Hot Module Replacement (proxies API & media calls to `:8765`) |
| **Python Backend & Web App** | `8765` | [http://127.0.0.1:8765/](http://127.0.0.1:8765/) | Full web application serving the production bundle, SQLite index, and REST endpoints |
| **Mobile P2P Ingest PWA** | `8765` | [http://127.0.0.1:8765/sync](http://127.0.0.1:8765/sync) | Mobile phone photo upload, pairing, and ingestion interface |
| **Prototype Preview** | `8765` | [http://127.0.0.1:8765/preview](http://127.0.0.1:8765/preview) | Standalone interactive glassmorphic UI prototype |
| **Library Statistics** | `8765` | [http://127.0.0.1:8765/api/stats](http://127.0.0.1:8765/api/stats) | JSON summary of photos, faces, duplicates, and categories |
| **Sync Status** | `8765` | [http://127.0.0.1:8765/api/sync/status](http://127.0.0.1:8765/api/sync/status) | Real-time mesh connection status, active SAS PIN, and pairing states |

### 3. Mobile P2P Sync Testing (Phone to Mac)

When `neural-gallery serve` or `neural-gallery sync` is running, you can connect your iOS or Android device using any of the following methods:

* **Universal Tunnel (Cloudflare Edge):**
  Auto-spawns when Cloudflare is detected. Bypasses router AP isolation and works across cellular networks (4G/5G) or guest Wi-Fi:
  ```text
  https://<tunnel-id>.trycloudflare.com/sync?pin=<PIN>
  ```
  *(Features an instant ON/OFF switch in the UI for complete air-gap isolation).*
* **Direct Local Wi-Fi IP:**
  Connects directly over your home Wi-Fi network:
  ```text
  http://<your-mac-local-ip>:8765/sync?pin=<PIN>
  ```
* **mDNS Hostname (Apple Bonjour):**
  Resolves automatically on iPhones and iPads:
  ```text
  http://<Mac-Name>.local:8765/sync?pin=<PIN>
  ```
* **Dynamic Anti-Brute-Force OTP:**
  The 6-digit SAS pairing PIN auto-rotates every 60 seconds with an active countdown timer until paired.

### 4. Health & Smoke Test Verification

You can quickly verify that the application and API layers are running properly:

```bash
# Verify backend HTTP/1.1 response
curl -I http://127.0.0.1:8765/

# Verify database index stats
curl -s http://127.0.0.1:8765/api/stats | jq .

# Verify Vite dev server and proxying
curl -I http://localhost:1420/
curl -s http://localhost:1420/api/stats | jq .
```

## CLI Commands

| Command | Description |
| :--- | :--- |
| `scan <folder>` | Index photos, RAW files, and videos under the folder with EXIF and GPS extraction. |
| `stats` | Display counts for total media, favorites, videos, RAW, portraits, screenshots, geocoded items, duplicates, faces, and pets. |
| `faces` | Run on-device Apple Vision framework face & pet detection and feature print grouping. |
| `sync` | Start the local air-gapped P2P Wi-Fi sync server for iOS & Android wireless ingestion. |
| `app` | Launch the borderless native macOS desktop window. |
| `serve` | Run the local review web interface at `http://127.0.0.1:8765`. |

---

## Local REST API & Webview Endpoints

Neural Gallery serves a local, air-gapped JSON REST API that powers both the browser interface and the native desktop webview:

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/stats` | `GET` | Library counters for all categories, favorites, media types, geocoded photos, and faces. |
| `/api/photos` | `GET` | Filtered photos grid by category (`all`, `favorites`, `recents`, `videos`, `screenshots`, `raw`, `panoramas`, `portraits`, `documents`, `duplicates`, `hidden`, `trash`), sort order, and pagination. |
| `/api/photo?id=<id>` | `GET` | Detailed metadata, full optical EXIF, GPS coords, face bounding boxes, and OCR text. |
| `/api/favorite` | `POST` | Toggle or set favorite status (`{"id": int, "is_favorite": bool}`). |
| `/api/hide` | `POST` | Toggle or set hidden vault status (`{"id": int, "is_hidden": bool}`). |
| `/api/trash` | `POST` | Soft-trash in vault or move to Finder Trash (`{"id": int, "soft": bool}`). |
| `/api/category` | `POST` | Update category tag for an item (`{"id": int, "category": str}`). |
| `/api/map/pins` | `GET` | Geocoded locations with latitude, longitude, city, thumbnail, and camera optics. |
| `/api/people` | `GET` | Clustered people and pets with face count, photo count, and sample crops. |
| `/api/people/candidates` | `GET` | Candidate face detections awaiting user verification ("Confirm Candidate Faces"). |
| `/api/person/confirm` | `POST` | Confirm a candidate face into a person group (`{"face_id": int, "person_key": str}`). |
| `/api/person/merge` | `POST` | Merge two person groups (`{"source": str, "target": str}`). |
| `/api/sync/status` | `GET` | P2P local Wi-Fi sync mesh status, paired devices, and SAS PIN pairing state. |
| `/api/sync/pair` | `POST` | Validate 6-digit SAS pairing PIN (`{"pin": str}`). |
| `/api/sync/unpair` | `POST` | Remove or unpair a connected device (`{"device_id": str}`). |
| `/api/sync/rotate-pin` | `POST` | Derive a fresh 6-digit SAS PIN. |
| `/api/sync/upload` | `POST` | Ingest wireless photo/video uploads from mobile PWA over local Wi-Fi. |
| `/sync` | `GET` | Zero-install local PWA web app for wireless iOS & Android camera roll uploads. |
| `/api/search` | `GET` | Search across OCR text, camera models, locations, and filenames. |
| `/media/<id>?w=<pixels>` | `GET` | On-the-fly thumbnail and preview delivery directly from local storage. |
| `/` | `GET` | Modern interactive glassmorphic gallery UI. |
| `/legacy` | `GET` | Classical 3-button keyboard review triage view. |

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `⌘1` | Switch to **Timeline View** |
| `⌘2` | Switch to **Explorer & Rapid Triage View** |
| `⌘3` | Switch to **Places & Geography Map View** |
| `⌘4` | Switch to **People & Pets Face Tracking View** |
| `⌘L` | Lock Vault (Master Password / Touch ID) |
| `⌘F` | Focus MobileCLIP Natural Language Search |
| `K` | **Keep** current photo |
| `N` | **Trash** duplicate / noise photo |
| `S` | **Skip** to next photo |

---

## Documentation

Full architectural specifications and guidelines are available in the [`docs/`](docs/INDEX.md) directory:

- [Master Architecture & Implementation Plan](plan.md)
- [System Architecture](docs/ARCHITECTURE.md) & [Architecture Overview](ARCHITECTURE.md)
- [Database Schema & Data Models](docs/DATABASE_SCHEMA.md) & [Backend Schema Spec](docs/specs/05_SCHEMA.md)
- [HTTP REST API & Desktop Bridge](docs/API_REFERENCE.md)
- [Core Algorithms & Vision Pipeline](docs/CORE_ALGORITHMS.md)
- [Security, Privacy & Sandboxing](docs/SECURITY_AND_PRIVACY.md)
- [Product Requirements Document (PRD)](docs/specs/01_PRD.md)
- [Technical Requirements Document (TRD)](docs/specs/02_TRD.md)
- [UI/UX Brief & Design System](docs/specs/04_UIUX_BRIEF.md)
- [Implementation Plan](docs/specs/06_IMPLEMENTATION_PLAN.md)

---

## Testing

Run the test suite using the project virtual environment:

```bash
.venv/bin/python -m unittest discover -s tests
```

---

## Contributing & PR Workflow

Contributions are managed through feature branches and Pull Requests against `main`:

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Commit your changes: `git commit -m "feat: description"`
3. Push to your branch and open a PR: `gh pr create`

---

## License

Neural Gallery is open-source software licensed under the [MIT License](LICENSE).
