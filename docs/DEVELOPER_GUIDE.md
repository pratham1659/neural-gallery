# Developer & Contributor Guide

This guide details how to configure a local development environment, execute the test suite, understand coding patterns, and contribute to **Neural Gallery**.

---

## 1. Prerequisites & Toolchain

* **Operating System:** macOS 12 (Monterey) or newer (macOS 14+ recommended for Apple Silicon Neural Engine features).
* **Python Runtime:** Python **3.11** or newer.
  * *Note on macOS defaults:* The system Python `/usr/bin/python3` is often Python 3.9 on older macOS releases. Use Homebrew to install modern Python:
    ```bash
    brew install python@3.13
    ```

---

## 2. Environment Setup

Clone the repository and initialize an isolated virtual environment:

```bash
cd /path/to/neural-gallery

# Create virtual environment using Python 3.13
python3.13 -m venv .venv

# Activate virtual environment
source .venv/bin/activate

# Install Neural Gallery in editable development mode
pip install -e .
```

### Dependency Architecture (`pyproject.toml`)

| Package | Minimum Version | Architectural Role |
| :--- | :--- | :--- |
| `pillow` | `>=10` | Raster decoding, EXIF metadata extraction, aspect ratio calculation, on-the-fly thumbnail generation. |
| `imagehash` | `>=4.3` | Perceptual Difference Hashing (`dhash`) generation. |
| `pywebview` | `>=5` | Cocoa webview integration rendering the desktop window. |
| `pyobjc-framework-Cocoa` | `>=10` | Objective-C bridge for AppKit (`NSWindow`, `NSAppearance`, `NSEvent`) and Foundation (`NSFileManager` Trash API). |
| `pyobjc-framework-Vision` | `>=10` | Objective-C bridge for Apple Vision framework (`VNDetectFaceRectanglesRequest`, `VNGenerateImageFeaturePrintRequest`). |
| `numpy` | `>=1.26` | Vector operations, L2 normalization, feature print buffers, and online centroid calculations. |

---

## 3. Running Neural Gallery Locally

### 3.1. CLI Execution

The installed entry point is `neural-gallery` (or `.venv/bin/neural-gallery`). Every subcommand accepts the global flag `--db <path>` to target a custom database:

```bash
# 1. Scan photos into index
neural-gallery scan ~/Pictures/Sample

# 2. Inspect index metrics
neural-gallery stats

# 3. Detect and group faces (Apple Vision)
neural-gallery faces

# 4. Open native desktop window
neural-gallery app --port 8765

# 5. Open review server in existing browser
neural-gallery serve --port 8765
```

### 3.2. Review Interface Navigation

* **URL:** `http://127.0.0.1:8765`
* **Keyboard Hotkeys:**
  * `K` — Mark photo as **Keep**
  * `N` — Mark photo as **Noise**
  * `S` — **Skip** photo
  * `←` / `→` — Navigate backward/forward in review history
* **Action Buttons:**
  * **Trash** — Prompts for confirmation, moves file to macOS Finder Trash via `NSFileManager`, and deletes index records.
  * **Move** — Moves photo to a chosen target folder.
  * **Trash Other Copies** — Keeps the current photo and trashes all near-duplicate copies in the same group.

---

## 4. Running the Test Suite

Neural Gallery uses Python's standard `unittest` module. Tests reside in the `tests/` directory:

```bash
# Run all tests
.venv/bin/python -m unittest discover -s tests

# Run specific test modules
.venv/bin/python -m unittest tests/test_neural_gallery.py
.venv/bin/python -m unittest tests/test_actions.py
.venv/bin/python -m unittest tests/test_desktop.py
```

### Test Design Patterns
* **No Real File Deletion:** Tests operate within `tempfile.TemporaryDirectory()`.
* **Synthetic Image Generation:** Helper `_pattern(seed: int)` creates reproducible pseudo-random RGB textures to test hashing without shipping heavy media binaries in git.
* **Ephemeral Servers:** Review HTTP server tests spin up `ThreadingHTTPServer` on ephemeral port `0` (`("127.0.0.1", 0)`) in background daemon threads.

---

## 5. Architectural Conventions & Design Patterns

### 5.1. Zero-External-Dependency Frontend
The entire frontend lives inside the string literal `PAGE` in `neural_gallery/review.py`. When making UI changes:
* **No Node/NPM/Webpack:** Write standard ES6+ JavaScript, CSS3 with CSS variables, and semantic HTML5.
* **Light/Dark Adaptive:** Style rules must respect `@media (prefers-color-scheme: dark)` and match the native AppKit window background constants in `neural_gallery/desktop.py` (`_LIGHT_BG` and `_DARK_BG`).
* **Safe DOM Updating:** Manipulate DOM elements cleanly without third-party frameworks.

### 5.2. Database & Thread Safety
* Always use `neural_gallery.db.connect(db_path)` to obtain a connection.
* **Do NOT share connections across threads.** Each HTTP request in `neural_gallery.review` must instantiate and close its own connection within `try...finally` blocks.
* Wrap state mutations in transactions; use `connection.commit()` or `connection.rollback()` appropriately.

### 5.3. Native macOS Event Loops
* Cocoa AppKit calls must execute on macOS's main thread.
* When triggering native actions from background threads or web callbacks, dispatch via `PyObjCTools.AppHelper.callAfter(fn, *args)`.

---

## 6. Contribution & Licensing Policy

* **License:** Neural Gallery is licensed under the **MIT License** (see [LICENSE](../LICENSE)).
* **Pull Requests:** Contributions are welcome at [github.com/pratham1659/neural-gallery](https://github.com/pratham1659/neural-gallery). All pull requests require review and approval from the repository owner as defined in `.github/CODEOWNERS`.
* **Verification Before Submitting:** Ensure that `.venv/bin/python -m unittest discover -s tests` passes with zero failures or errors before opening a pull request.

