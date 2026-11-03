# Neural Gallery Architecture Overview

> **Looking for the full technical documentation suite?**
> Visit the **[Neural Gallery Documentation Hub](docs/INDEX.md)** for exhaustive architectural, database, API, algorithm, security, and developer specifications.

---

## System Overview

**Neural Gallery** is a local, privacy-first photo indexing and culling application engineered natively for macOS. It allows users to rapidly triage unorganized photo libraries into **Keep** or **Noise**, detect near-duplicate images, and cluster recurring faces—all without third-party cloud services or telemetry.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          neural_gallery.cli                            │
│         CLI commands: scan, stats, faces, app, serve                   │
└───────────────┬────────────────────────────────────────┬───────────────┘
                │                                        │
                ▼                                        ▼
┌──────────────────────────────┐        ┌────────────────────────────────┐
│     neural_gallery.scan      │        │     neural_gallery.desktop     │
│ Ingestion, EXIF metadata,    │        │ Native AppKit borderless Cocoa │
│ dhash, screenshot detection  │        │ window via PyWebView           │
└───────────────┬──────────────┘        └────────────────┬───────────────┘
                │                                        │
                ▼                                        ▼
┌──────────────────────────────┐        ┌────────────────────────────────┐
│  neural_gallery.duplicates   │        │     neural_gallery.review      │
│ Union-Find clustering and    │        │ Localhost ThreadingHTTPServer  │
│ Banded 16-bit LSH (>8k)      │        │ with embedded SPA frontend     │
└───────────────┬──────────────┘        └────────────────┬───────────────┘
                │                                        │
                ▼                                        ▼
┌──────────────────────────────┐        ┌────────────────────────────────┐
│     neural_gallery.faces     │        │ neural_gallery.actions & access│
│ Apple Vision framework       │        │ Path sandboxing & non-lethal   │
│ detection & feature prints   │        │ Finder Trash via NSFileManager │
└───────────────┬──────────────┘        └────────────────┬───────────────┘
                │                                        │
                └───────────────────┬────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │   neural_gallery.db   │
                        │ SQLite in WAL mode    │
                        │ Mode 0600 permissions │
                        └───────────────────────┘
```

---

## Core Subsystems

| Module | Purpose | Key Technical Details |
| :--- | :--- | :--- |
| **[`neural_gallery.scan`](docs/ARCHITECTURE.md#31-ingestion--scanning-subsystem-neural_galleryscan)** | Directory Crawler & Ingestion | Recursive filesystem crawler, stat cache checks, EXIF parser (`Make`, `Model`, `DateTimeOriginal`), screenshot aspect-ratio filter ($[1.7, 2.4]$), and 64-bit dhash generation. |
| **[`neural_gallery.duplicates`](docs/CORE_ALGORITHMS.md#2-near-duplicate-clustering--banded-lsh)** | Near-Duplicate Engine | 64-bit dhash Hamming distance ($\le 8$), Disjoint-Set Union (Union-Find) clustering, and 16-bit Banded Locality-Sensitive Hashing past 8,000 photos. |
| **[`neural_gallery.faces`](docs/CORE_ALGORITHMS.md#3-apple-vision-face-recognition-pipeline)** | Face Recognition Pipeline | Native PyObjC bindings to Apple Vision framework (`VNDetectFaceRectanglesRequest`), bottom-left coordinate inversion with 25% padding, `VNGenerateImageFeaturePrintRequest` (512-d float32 vectors), and online centroid clustering (cosine distance $\le 0.34$). |
| **[`neural_gallery.learn`](docs/CORE_ALGORITHMS.md#4-heuristic-suggestion-engine-neural_gallerylearn)** | Suggestion Heuristics | Zero-weight 1-Nearest Neighbor classifier comparing Hamming distances against known `keep` and `noise` hashes with a 4-bit decision margin. |
| **[`neural_gallery.access`](docs/SECURITY_AND_PRIVACY.md#2-path-sandboxing--access-control-neural_galleryaccess)** | Security & Path Sandboxing | Canonical path verification (`allowed_file`), symlink rejection, and root containment enforcement against the `roots` database table. |
| **[`neural_gallery.actions`](docs/SECURITY_AND_PRIVACY.md#4-non-destructive-file-operations-neural_galleryactions)** | Action Dispatcher | Safe non-destructive deletion routing to macOS Finder Trash via Cocoa `NSFileManager`, collision-free directory moving, and Finder reveal (`open -R`). |
| **[`neural_gallery.db`](docs/DATABASE_SCHEMA.md)** | Persistence & Schema | SQLite storage at `~/Library/Application Support/Neural Gallery/neural_gallery.sqlite` configured in WAL mode, foreign keys, process umask `0077`, and POSIX mode `0600`. |
| **[`neural_gallery.desktop`](docs/ARCHITECTURE.md#36-presentation-layer-neural_gallerydesktop-neural_galleryreview)** | macOS Native Desktop Shell | PyWebView wrapper running Cocoa AppKit chrome (`gui="cocoa"`), borderless Arc-style styling, traffic light preservation, background dragging, arrow key event interception, and dark mode syncing. |
| **[`neural_gallery.review`](docs/API_REFERENCE.md)** | Localhost HTTP Server & Web UI | Loopback HTTP daemon (`ThreadingHTTPServer` on `127.0.0.1`), embedded zero-dependency HTML5/CSS/JS Single Page Application, `X-Neural-Gallery: 1` CSRF mitigation, and on-the-fly JPEG thumbnailing. |
| **[`neural_gallery.cli`](docs/DEVELOPER_GUIDE.md#31-cli-execution)** | Command-Line Interface | CLI entry point dispatching `scan`, `stats`, `faces`, `app`, and `serve` commands. |

---

## Architectural Invariants for Developers & AI Agents

1. **Non-Destructive Deletions:** All photo removals MUST route through `neural_gallery.actions.trash_file` to the macOS Finder Trash. Never use `os.remove` or `unlink`.
2. **Access Control Barrier:** All media requests MUST validate candidate file paths through `neural_gallery.access.allowed_file`. Symlinks and paths outside `roots` are strictly rejected.
3. **Loopback Isolation:** The review server binds exclusively to `127.0.0.1`.
4. **Coordinate Space Orientation:** Apple Vision coordinates originate at the bottom-left $[0.0, 1.0]$ and must be transformed via `neural_gallery.faces.crop_box` before PIL cropping.
5. **Database Protection:** Permissions must remain locked to user-only mode `0600`.

---

## Detailed Technical Guides

For comprehensive deep dives, refer to:
* **[Database Schema & Models](docs/DATABASE_SCHEMA.md)**
* **[HTTP REST API Reference](docs/API_REFERENCE.md)**
* **[Core Algorithms & Vision Pipeline](docs/CORE_ALGORITHMS.md)**
* **[Security & Privacy Specification](docs/SECURITY_AND_PRIVACY.md)**
* **[Developer Setup & Testing Guide](docs/DEVELOPER_GUIDE.md)**
* **[AI Agent Context & Symbols Manual](docs/AGENT_GUIDE.md)**
* **[Roadmap: Encrypted Mac Silicon AI Vault](docs/ROADMAP_AI_VAULT.md)**

