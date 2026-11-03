# Neural Gallery

An encrypted, zero-knowledge local photo gallery and AI vault for Apple Silicon macOS.

Neural Gallery indexes photos stored on your Mac, performs on-device face recognition and perceptual hashing, detects near-duplicates and screenshots, and provides high-speed photo culling into **Keep** or **Noise** with zero cloud telemetry.

> **Next-Generation Architecture in Progress:** We are transitioning Neural Gallery to a native **Rust (Tauri v2) + Apple Neural Engine (Core ML / MobileCLIP)** architecture. Review the full roadmap in [**`plan.md`**](plan.md).

---

## Quickstart (v0.2.0 Engine)

### Requirements
* macOS 12 Monterey or newer (optimized for Apple Silicon M-series).
* Python 3.11 or newer (Homebrew Python 3.13 recommended).

```bash
# Set up virtual environment
python3 -m venv .venv
source .venv/bin/activate
pip install -e .

# Scan any folder of photos
neural-gallery scan ~/Pictures

# View library statistics
neural-gallery stats

# Run on-device Apple Vision face grouping
neural-gallery faces

# Launch native desktop window
neural-gallery app

# Or open in web browser
neural-gallery serve
```

---

## Commands

| Command | Description |
| :--- | :--- |
| `scan <folder>` | Index JPEG, PNG, WebP, GIF, and TIFF images under the folder. Read-only operation. |
| `stats` | Display counts for total photos, unlabeled items, screenshots, duplicate groups, faces, and people. |
| `faces` | Run on-device Apple Vision framework face detection and feature print grouping. |
| `app` | Launch the borderless native macOS desktop window. |
| `serve` | Run the review web interface at `http://127.0.0.1:8765`. |

---

## Key Features

* **Zero-Knowledge & Privacy-First:** 100% on-device processing. No accounts, no subscriptions, and zero external telemetry.
* **Non-Destructive by Design:** Photo triage never uses permanent delete syscalls (`unlink`). All discards route safely to the macOS **Finder Trash** (`~/.Trash`).
* **Near-Duplicate Detection:** 64-bit difference hashing (`dhash`) clusters near-duplicate photos and burst sequences sharing Hamming distances $\le 8$ bits.
* **Screenshot Detection:** Automatically flags screen captures using resolution aspect ratios ($[1.7, 2.4]$) and missing camera EXIF data.
* **Interactive UI Preview:** Open [`preview.html`](preview.html) in your browser to preview the upcoming Google Photos-style timeline, dual-mode explorer, and biometric Touch ID lock screen.

---

## Documentation

Full architectural documentation for developers and AI agents is available in the [`docs/`](docs/INDEX.md) directory:

- [System Architecture](docs/ARCHITECTURE.md) & [Architecture Overview](ARCHITECTURE.md)
- [Database Schema & Data Models](docs/DATABASE_SCHEMA.md)
- [HTTP REST API & Desktop Bridge](docs/API_REFERENCE.md)
- [Core Algorithms & Vision Pipeline](docs/CORE_ALGORITHMS.md)
- [Security, Privacy & Sandboxing](docs/SECURITY_AND_PRIVACY.md)
- [Developer & Contributor Guide](docs/DEVELOPER_GUIDE.md)
- [AI Agent Context & Operational Manual](docs/AGENT_GUIDE.md)
- [AI Vault Evolution Roadmap](docs/ROADMAP_AI_VAULT.md)

---

## Testing

```bash
.venv/bin/python -m unittest discover -s tests
```

---

## Contributing

Contributions are welcome! Please open an issue or pull request against `main` at [github.com/pratham1659/neural-gallery](https://github.com/pratham1659/neural-gallery).

---

## License

Neural Gallery is open-source software licensed under the [MIT License](LICENSE).
