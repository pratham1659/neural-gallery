# AI Agent Context & Operational Manual

This operational manual is authored specifically for **autonomous AI coding agents** (LLMs, pair programmers, code generators) interacting with the **Neural Gallery** repository. It outlines system invariants, symbol references, AST boundaries, and recipes for extending code safely.

---

## 1. System Identity & Mission

* **Repository:** `neural-gallery`
* **Language:** Python 3.11+
* **Frameworks:** Native macOS PyObjC (`Cocoa`, `Vision`), `Pillow`, `imagehash`, `pywebview`, `numpy`.
* **Primary Mission:** On-device photo culling and indexing for macOS, categorizing images into **Keep** or **Noise** via perceptual hashing and Apple Vision face grouping.

---

## 2. Immutable Architectural Invariants

When modifying or refactoring this codebase, an AI agent **MUST NEVER** violate the following rules:

### Invariant 1: Non-Destructive Deletion via Finder Trash
* **RULE:** Never introduce `os.remove()`, `os.unlink()`, or `shutil.rmtree()` for media files.
* **ENFORCEMENT:** All file deletion operations must route through `neural_gallery.actions.trash_file`, which utilizes Cocoa's `NSFileManager.trashItemAtURL_resultingItemURL_error_()`. Files must remain recoverable in `~/.Trash`.

### Invariant 2: Path Sandboxing Barrier (`allowed_file`)
* **RULE:** Never bypass or loosen `neural_gallery.access.allowed_file(connection, file_id)` when resolving media paths.
* **ENFORCEMENT:** A path must:
  1. Exist in SQLite `files` table.
  2. Resolve to a regular file (`candidate.is_file()` is `True`).
  3. **NOT** be a symbolic link (`candidate.is_symlink()` is `False`).
  4. Reside within an indexed root directory recorded in the `roots` table (`candidate.relative_to(root)`).

### Invariant 3: Loopback-Only Network Binding
* **RULE:** Never bind HTTP sockets to `0.0.0.0` or any external IP address.
* **ENFORCEMENT:** The server host must strictly remain `"127.0.0.1"`.

### Invariant 4: Vision Coordinate Inversion
* **RULE:** Never assume Apple Vision bounding boxes use top-left origins.
* **ENFORCEMENT:** Apple Vision bounding boxes have their origin at the **bottom-left** with normalized coordinates $[0.0, 1.0]$. The coordinate transformation formula in `neural_gallery.faces.crop_box` (`top = int((1.0 - y - h) * height)`) must be preserved.

### Invariant 5: CSRF Protection (`X-Neural-Gallery: 1`)
* **RULE:** Never remove the `X-Neural-Gallery: 1` header check from mutating HTTP endpoints (`POST /api/*`).
* **ENFORCEMENT:** Any request mutating labels, people, trash, or file locations must validate `headers.get("X-Neural-Gallery") == "1"`.

### Invariant 6: Local File Permissions (`0600`)
* **RULE:** Never permit the SQLite database or its WAL files to be world-readable.
* **ENFORCEMENT:** File permissions must be set to `0o600` (`-rw-------`), and process umask must be temporarily forced to `0o077` during connection creation.

---

## 3. Symbol Catalog & AST Reference

### 3.1. Module `neural_gallery.access`
* `allowed_file(connection: sqlite3.Connection, file_id: int) -> Path | None`
  * Resolves file ID, validates against symlinks, verifies path is child of a registered root.

### 3.2. Module `neural_gallery.actions`
* `class ActionError(Exception)`
* `forget(connection: sqlite3.Connection, file_id: int) -> None`
  * Deletes face instances, dissolves duplicate groups with $< 2$ members, removes file record.
* `trash_file(path: Path) -> str`
  * Interacts with Cocoa `NSFileManager` to send file to Trash. Returns destination trash path string.
* `trash_indexed(connection: sqlite3.Connection, file_id: int) -> str`
  * Validates via `allowed_file`, trashes on disk, invokes `forget()`.
* `trash_other_copies(connection: sqlite3.Connection, file_id: int) -> dict`
  * Trashes all peer files sharing the same `dup_groups.group_key`. Returns `{"trashed": int, "failed": int}`.
* `move_indexed(connection: sqlite3.Connection, file_id: int, destination: Path) -> str`
  * Validates source, verifies destination folder, moves file with collision avoidance, updates `roots` and `files`.
* `reveal(connection: sqlite3.Connection, file_id: int) -> None`
  * Executes subprocess `open -R <path>` to reveal item in Finder.
* `_unique_target(folder: Path, name: str, file_id: int) -> Path`
  * Resolves destination collision as `<stem>-<file_id><suffix>`.

### 3.3. Module `neural_gallery.db`
* `SCHEMA: str` — SQLite DDL script.
* `migrate(connection: sqlite3.Connection) -> None`
  * Adds missing columns (e.g. `faces_scanned`).
* `connect(db_path: Path) -> sqlite3.Connection`
  * Opens connection with umask `0077`, enforces WAL, foreign keys, and mode `0600`.
* `default_db() -> Path`
  * Returns `~/Library/Application Support/Neural Gallery/neural_gallery.sqlite`.

### 3.4. Module `neural_gallery.duplicates`
* `HAMMING_THRESHOLD: int = 8`
* `PAIRWISE_LIMIT: int = 8000`
* `hamming(left: int, right: int) -> int`
  * Returns `(left ^ right).bit_count()`.
* `rebuild_groups(connection: sqlite3.Connection, threshold: int = 8) -> int`
  * Disjoint-set union-find clustering over all non-empty dhashes. Returns cluster count.
* `_union_banded(items: list[tuple[int, int]], union, threshold: int) -> None`
  * 16-bit 4-band LSH clustering for libraries $> 8,000$ files.

### 3.5. Module `neural_gallery.faces`
* `MATCH_DISTANCE: float = 0.34`
* `crop_box(width: int, height: int, x: float, y: float, w: float, h: float, pad: float = 0.25) -> tuple[int, int, int, int] | None`
  * Converts Vision bottom-left box to PIL top-left pixel box `(left, top, right, bottom)`.
* `_feature_print(image: Image.Image) -> np.ndarray | None`
  * Runs `VNGenerateImageFeaturePrintRequest`, extracts normalized 512-d float32 vector.
* `_detect_boxes(path: Path) -> list[tuple[float, float, float, float]]`
  * Runs `VNDetectFaceRectanglesRequest`, extracts normalized boxes.
* `index_faces(path: Path) -> list[dict]`
  * Detects faces, crops patches, generates feature vectors.
* `scan_faces(db_path: Path, progress=print) -> dict`
  * Batches unindexed files, records faces, clusters people.
* `assign_people(connection: sqlite3.Connection, threshold: float = 0.34) -> int`
  * Online centroid cosine clustering.
* `list_people(connection: sqlite3.Connection) -> list[dict]`
  * Returns identified people with $\ge 2$ face instances.
* `name_person(connection: sqlite3.Connection, person_key: str, name: str) -> None`
  * Sets or clears human name for `p<id>`.

### 3.6. Module `neural_gallery.learn`
* `MARGIN: int = 4`
* `load_examples(connection: sqlite3.Connection) -> tuple[list[int], list[int]]`
  * Returns `(keep_hashes, noise_hashes)`.
* `suggest(row: sqlite3.Row, keep_hashes: list[int], noise_hashes: list[int]) -> str | None`
  * Computes 1-NN Hamming distance with margin threshold.

### 3.7. Module `neural_gallery.review`
* `PAGE: str` — Complete embedded SPA HTML/CSS/JS.
* `make_handler(db_path: Path) -> type[BaseHTTPRequestHandler]`
  * Factory returning HTTP request handler class.
* `serve(db_path: Path, port: int = 8765) -> None`
  * Runs blocking `ThreadingHTTPServer`.

### 3.8. Module `neural_gallery.scan`
* `IMAGE_SUFFIXES: set[str] = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff"}`
* `looks_like_screenshot(path: Path, width: int, height: int, has_camera: bool, has_taken: bool) -> bool`
* `index_file(path: Path) -> dict | None`
* `scan_folder(folder: Path, db_path: Path) -> dict`

### 3.9. Module `neural_gallery.desktop`
* `class DesktopApi`
  * `choose_folder() -> str`
  * `begin_drag() -> None`
  * `set_typing(on: bool) -> None`
* `open_window(db_path, port: int = 8765) -> None`
  * Launches PyWebView Cocoa window with custom borderless style mask and arrow key monitor.

---

## 4. Common Agent Recipes

### Recipe 1: Adding a New Queue Filter (Bucket)
1. In `neural_gallery/review.py`:
   * Update `_where(bucket, skip_ids, person_key)`: add `elif bucket == "your_bucket": where.append("...")`.
   * Update `PAGE` HTML: Add `<button class="pile" data-bucket="your_bucket" ...>` in `<nav id="piles">`.
   * Update `PAGE` JS: Add `your_bucket` to `counts` mapping in `refreshStats()`.
2. Update tests in `tests/test_neural_gallery.py` to assert queue behavior.

### Recipe 2: Adding a Database Column
1. In `neural_gallery/db.py`:
   * Add column to `SCHEMA` string in `CREATE TABLE IF NOT EXISTS files`.
   * In `migrate(connection)`: Check `if "new_column" not in columns:` and run `ALTER TABLE files ADD COLUMN ...`.
2. Update `index_file(path)` in `neural_gallery/scan.py` to extract and return the field.
3. Update `INSERT` and `UPDATE` statements in `scan_folder()`.

---

## 5. Verification Checklist Before Committing Changes

1. **Static Syntax & Import Check:** Verify all imports exist and Python 3.11+ syntax is valid.
2. **Execute Unit Tests:** Run `python -m unittest discover -s tests`. All tests must pass.
3. **Verify Security Invariants:** Ensure no direct file deletions, path traversal vulnerabilities, or un-sanitized queries were introduced.
4. **Preserve Comments:** Keep docstrings and domain-specific architectural notes intact.

