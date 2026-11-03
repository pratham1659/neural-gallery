# Security, Privacy & Sandboxing Architecture

This document details the security principles, data protection boundaries, threat mitigations, and safety guarantees implemented in Neural Gallery.

---

## 1. Security & Privacy Tenets

Neural Gallery is designed under a zero-trust model regarding network communication and destructive filesystem modifications:
1. **Zero External Network Egress:** Neural Gallery contains no analytics SDKs, crash reporters, remote telemetry endpoints, or cloud synchronizers. The application will never establish outbound network connections.
2. **Loopback-Only Interface:** The built-in HTTP server binds strictly to the loopback address `127.0.0.1`. It refuses to bind to `0.0.0.0` or public network adapters.
3. **Guaranteed Non-Destructive Operation:** Files are never permanently expunged via low-level syscalls (`unlink` / `rm`). All deletions route to the macOS Finder Trash, where users retain full recovery authority.

---

## 2. Path Sandboxing & Access Control (`neural_gallery.access`)

Because Neural Gallery allows users to view thumbnails and perform actions via an HTTP service, path traversal and unauthorized filesystem access are principal attack vectors.

### 2.1. The `allowed_file` Barrier

Every request touching the local filesystem (thumbnail generation, trashing, moving, revealing) **MUST** resolve through `neural_gallery.access.allowed_file`:

```python
def allowed_file(connection, file_id: int) -> Path | None:
    row = connection.execute("SELECT path FROM files WHERE id = ?", (file_id,)).fetchone()
    if row is None:
        return None
    candidate = Path(row["path"]).resolve()
    if not candidate.is_file() or candidate.is_symlink():
        return None
    roots = [Path(item["path"]).resolve() for item in connection.execute("SELECT path FROM roots")]
    for root in roots:
        try:
            candidate.relative_to(root)
            return candidate
        except ValueError:
            continue
    return None
```

### 2.2. Security Guarantees
* **Canonical Path Resolution:** Symlinks and relative paths (`../`) are resolved to their canonical disk targets via `.resolve()`.
* **Symlink Traversal Prevention:** If a path resolves to a symlink (`candidate.is_symlink()`), access is denied immediately. This prevents attackers from symlinking `/etc/passwd` or `~/.ssh/id_rsa` into an indexed folder to extract arbitrary system files via `/media/<id>`.
* **Strict Root Enclosure:** Access is granted if and only if `candidate.relative_to(root)` succeeds for at least one registered folder path in the `roots` database table. Files outside scanned roots cannot be accessed, even if their paths are manually inserted into SQLite.

---

## 3. Database Security & File Permissions (`neural_gallery.db`)

Neural Gallery’s database contains image metadata, difference hashes, face coordinates, and face embeddings. This data is protected at rest using POSIX access control:

* **POSIX Mode 0600 (`-rw-------`):** The database file (`neural_gallery.sqlite`) and its SQLite Write-Ahead Log sidecars (`-wal` and `-shm`) are explicitly chmodded to `0600`. Only the user executing the Neural Gallery process has read and write privileges. Other local accounts cannot inspect the index.
* **Process Umask Manipulation:** To prevent race conditions where files might temporarily inherit a permissive system umask during creation, `neural_gallery.db.connect()` wraps connection initialization in an explicit `0077` umask:
  ```python
  previous = os.umask(0o077)
  try:
      connection = sqlite3.connect(db_path, timeout=30)
  finally:
      os.umask(previous)
  ```

---

## 4. Non-Destructive File Operations (`neural_gallery.actions`)

Neural Gallery adheres strictly to safe file manipulation semantics:

### 4.1. macOS Finder Trash Integration

Rather than invoking `os.remove()` or `shutil.rmtree()`, Neural Gallery interfaces with Cocoa's `NSFileManager` via PyObjC:

```python
def trash_file(path: Path) -> str:
    from Foundation import NSURL, NSFileManager

    url = NSURL.fileURLWithPath_(str(path))
    result = NSFileManager.defaultManager().trashItemAtURL_resultingItemURL_error_(url, None, None)
    ok = result[0] if isinstance(result, tuple) else bool(result)
    if not ok:
        detail = result[-1] if isinstance(result, tuple) else "Finder refused the Trash"
        raise ActionError(str(detail))
    trashed = result[1] if isinstance(result, tuple) and result[1] is not None else path
    return str(trashed)
```

* **Auditability & Recovery:** Files sent to the Trash appear in the user's macOS Trash can (`~/.Trash`), preserving the original folder metadata and permitting one-click "Put Back".
* **System Safeguards:** If the volume or filesystem refuses deletion (e.g. read-only volume, SIP restriction), the Cocoa API raises an `ActionError` and the index transaction rolls back.

### 4.2. Conflict-Free File Movement

When moving an indexed file to a new target directory via `neural_gallery.actions.move_indexed`:
1. Destination directory existence is validated.
2. File collisions are detected: if `destination / name` already exists, Neural Gallery avoids overwriting by appending the unique file ID (`f"{stem}-{file_id}{suffix}"`).
3. The destination folder is added to the `roots` table (`INSERT OR IGNORE INTO roots`), ensuring the moved photo remains authorized under the sandboxing model.

---

## 5. Web & API Security (`neural_gallery.review`)

Because the web application runs on `127.0.0.1`, untrusted web pages running in a user's browser could theoretically attempt Cross-Site Request Forgery (CSRF) or DNS rebinding attacks against local services. Neural Gallery employs targeted defenses:

* **Mandatory Custom Header:** All state-modifying requests (`POST /api/*`) enforce the presence of a custom header:
  ```
  X-Neural-Gallery: 1
  ```
  Browsers will not attach custom headers to cross-origin requests (`<img>`, `<form>`, or simple `fetch`) without a preflight CORS check. Because Neural Gallery does not implement or allow CORS headers, cross-origin web pages cannot invoke Neural Gallery actions.
* **Payload Size Ceiling:** Request bodies are bounded at `8,192` bytes (`length > 8192` rejected with `400 Bad Request`), preventing buffer exhaustion or memory starvation attacks.
* **MIME Sniffing & Cache Control:**
  * `X-Content-Type-Options: nosniff` stops browsers from MIME-sniffing served assets.
  * `Cache-Control: no-store` prevents sensitive photo thumbnails and JSON metadata from lingering in shared browser disk caches.
* **Image Decompression Bomb Defense:** Image thumbnailing wraps all operations in exception handlers catching `Image.DecompressionBombError`, rejecting maliciously crafted ultra-large image files.

