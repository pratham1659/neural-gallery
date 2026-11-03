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

## CLI Commands

| Command | Description |
| :--- | :--- |
| `scan <folder>` | Index photos, RAW files, and videos under the folder with EXIF and GPS extraction. |
| `stats` | Display counts for total media, favorites, videos, RAW, portraits, screenshots, geocoded items, duplicates, faces, and pets. |
| `faces` | Run on-device Apple Vision framework face & pet detection and feature print grouping. |
| `app` | Launch the borderless native macOS desktop window. |
| `serve` | Run the local review web interface at `http://127.0.0.1:8765`. |

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
