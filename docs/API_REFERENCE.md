# HTTP REST API & Desktop Bridge Reference

This document provides a technical reference for Neural Gallery's internal HTTP REST API and native PyWebView JavaScript bridge.

---

## 1. Network & Security Architecture

* **Host & Port:** Bound strictly to loopback (`127.0.0.1`). Default port is `8765`. If occupied during GUI startup, port fallback selects an ephemeral port (`port = 0`).
* **Cross-Site Request Forgery (CSRF) Mitigation:** All state-modifying requests (`POST`) **MUST** include the header:
  ```http
  X-Neural-Gallery: 1
  ```
  Requests lacking this header are rejected with `400 Bad Request: missing X-Neural-Gallery header`.
* **Payload Constraints:** POST bodies must be valid JSON and cannot exceed **8,192 bytes** (`Content-Length <= 8192`).
* **Security Headers Emitted:**
  * `Cache-Control: no-store`
  * `X-Content-Type-Options: nosniff`

---

## 2. API Endpoints Catalog

| Method | Endpoint | Description | Requires `X-Neural-Gallery: 1` |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Serves the single-page application (HTML/CSS/JS). | No |
| `GET` | `/icon.png` | Serves the application icon PNG. | No |
| `GET` | `/api/stats` | Retrieves global database metrics. | No |
| `GET` | `/api/queue` | Retrieves a batch of file stubs for navigation. | No |
| `GET` | `/api/next` | Fetches full metadata and suggestion for the next candidate. | No |
| `GET` | `/api/duplicate-group` | Retrieves candidate duplicate cluster files. | No |
| `GET` | `/api/people` | Lists identified face clusters with $\ge 2$ occurrences. | No |
| `GET` | `/api/person-photos` | Returns all photos belonging to a face cluster. | No |
| `GET` | `/media/<id>` | Streams a dynamically generated JPEG thumbnail. | No |
| `POST` | `/api/scan` | Initiates directory scanning. | **Yes** |
| `POST` | `/api/label` | Updates user label (`keep`, `noise`, or clear). | **Yes** |
| `POST` | `/api/person` | Assigns or clears a human name for a face cluster. | **Yes** |
| `POST` | `/api/trash` | Moves an indexed file to macOS Finder Trash. | **Yes** |
| `POST` | `/api/trash-copies` | Trashes all duplicate copies except the specified file. | **Yes** |
| `POST` | `/api/move` | Relocates an indexed file to a target folder. | **Yes** |
| `POST` | `/api/reveal` | Highlights the file in macOS Finder via `open -R`. | **Yes** |

---

## 3. Detailed Endpoint Specifications

### 3.1. `GET /api/stats`

Returns aggregated counts across all database entities.

* **Response Status:** `200 OK`
* **Response Body (`application/json`):**
```json
{
  "total": 4512,
  "unlabeled": 1204,
  "screenshots": 340,
  "keep": 2500,
  "noise": 808,
  "duplicate_groups": 84,
  "faces": 1540,
  "people": 23
}
```

---

### 3.2. `GET /api/queue`

Fetches an array of lightweight file items for pre-populating navigation stacks.

* **Query Parameters:**
  * `bucket` (optional, default `"inbox"`): One of `inbox`, `screenshots`, `duplicates`, `keep`, `noise`, `faces`.
  * `skip` (optional): Comma-separated list of integer IDs to exclude (e.g. `skip=1,2,5`).
  * `person` (optional): Filter to a specific person key (e.g. `person=p12`).
  * `limit` (optional, default `4`): Number of records to return (clamped between 1 and 12).
* **Response Status:** `200 OK`
* **Response Body (`application/json`):**
```json
[
  {"id": 101, "name": "IMG_4901.jpg"},
  {"id": 102, "name": "Screenshot 2026-10-31.png"}
]
```

---

### 3.3. `GET /api/next`

Retrieves detailed metadata, clustering relations, and heuristic suggestion for the next candidate in a queue.

* **Query Parameters:** Same as `/api/queue` (`bucket`, `skip`, `person`).
* **Response Status:**
  * `200 OK`: File found.
  * `204 No Content`: Pile/queue is empty.
* **Response Body (`application/json`):**
```json
{
  "id": 102,
  "path": "/Users/prathamkumar/Pictures/IMG_4902.jpg",
  "name": "IMG_4902.jpg",
  "width": 4032,
  "height": 3024,
  "is_screenshot": false,
  "label": null,
  "dup_count": 3,
  "face_count": 2,
  "person_names": "Alice, Bob",
  "suggestion": "keep"
}
```
*Note: `suggestion` is one of `"keep"`, `"noise"`, or `null`.*

---

### 3.4. `GET /api/duplicate-group`

Retrieves files associated with the next duplicate cluster having at least 2 members.

* **Query Parameters:**
  * `skip` (optional): Comma-separated list of group keys to bypass (e.g. `skip=101,105`).
* **Response Status:**
  * `200 OK`: Cluster found.
  * `204 No Content`: No remaining duplicate groups.
* **Response Body (`application/json`):**
```json
{
  "group_key": "101",
  "files": [
    {
      "id": 101,
      "name": "IMG_4901.jpg",
      "path": "/Users/prathamkumar/Pictures/IMG_4901.jpg",
      "width": 4032,
      "height": 3024,
      "label": null
    },
    {
      "id": 104,
      "name": "IMG_4901_copy.jpg",
      "path": "/Users/prathamkumar/Pictures/IMG_4901_copy.jpg",
      "width": 4032,
      "height": 3024,
      "label": null
    }
  ]
}
```

---

### 3.5. `GET /api/people`

Returns person clusters having $\ge 2$ associated face crops.

* **Response Status:** `200 OK`
* **Response Body (`application/json`):**
```json
[
  {
    "person_key": "p12",
    "name": "Sarah Connor",
    "face_count": 14,
    "photo_count": 9,
    "sample_id": 402
  }
]
```

---

### 3.6. `GET /api/person-photos`

Retrieves all photos assigned to a specific person cluster.

* **Query Parameters:**
  * `person` (required): Cluster key string (e.g. `person=p12`). Format must match `^p\d+$`.
* **Response Status:**
  * `200 OK`: Cluster retrieved.
  * `400 Bad Request`: Invalid or missing `person` parameter.
* **Response Body (`application/json`):**
```json
{
  "person_key": "p12",
  "name": "Sarah Connor",
  "files": [
    {
      "id": 402,
      "name": "vacation1.jpg",
      "width": 3840,
      "height": 2160,
      "is_screenshot": false,
      "label": "keep",
      "dup_count": 0,
      "face_count": 1,
      "person_names": "Sarah Connor",
      "suggestion": ""
    }
  ]
}
```

---

### 3.7. `GET /media/<id>`

Generates an on-the-fly resized JPEG thumbnail of an indexed image.

* **URL Parameters:**
  * `<id>`: Integer ID of the file in SQLite.
* **Query Parameters:**
  * `w` (optional, default `1600`): Maximum bounding box edge dimension. Clamped between `120` and `1600`.
* **Security Check:** Evaluated against `neural_gallery.access.allowed_file`. If the file is not within a scanned root or is a symlink, responds with `404 Not Found`.
* **Response Status:**
  * `200 OK`: Binary image data (`Content-Type: image/jpeg`).
  * `404 Not Found`: File not found, path outside roots, unreadable, or decompression bomb.

---

### 3.8. `POST /api/scan`

Scans a folder and records its contents in the index.

* **Headers:** `X-Neural-Gallery: 1`, `Content-Type: application/json`
* **Request Body:**
```json
{
  "folder": "/Users/prathamkumar/Pictures/Trip"
}
```
* **Response Status:**
  * `200 OK`:
    ```json
    {
      "seen": 250,
      "added": 180,
      "updated": 10,
      "unchanged": 60,
      "unreadable": 0,
      "duplicate_groups": 12
    }
    ```
  * `400 Bad Request`: `{"error": "folder is required"}` or directory does not exist.

---

### 3.9. `POST /api/label`

Applies or clears a triage classification.

* **Headers:** `X-Neural-Gallery: 1`, `Content-Type: application/json`
* **Request Body:**
```json
{
  "id": 102,
  "label": "keep"
}
```
*Note: `label` must be `"keep"`, `"noise"`, or `""` (to clear).*
* **Response Status:**
  * `200 OK`: `{"id": 102, "label": "keep"}`
  * `404 Not Found`: File ID not present in index.

---

### 3.10. `POST /api/person`

Assigns or removes a human display name for a person key.

* **Headers:** `X-Neural-Gallery: 1`, `Content-Type: application/json`
* **Request Body:**
```json
{
  "person_key": "p12",
  "name": "Sarah Connor"
}
```
*Note: Setting `name` to empty string (`""`) deletes the name entry from `people` table.*
* **Response Status:**
  * `200 OK`: `{"person_key": "p12", "name": "Sarah Connor"}`
  * `404 Not Found`: `{"error": "unknown person"}`

---

### 3.11. `POST /api/trash`

Moves an indexed photo to the user's macOS Finder Trash and purges its index record.

* **Headers:** `X-Neural-Gallery: 1`, `Content-Type: application/json`
* **Request Body:**
```json
{
  "id": 104
}
```
* **Response Status:**
  * `200 OK`:
    ```json
    {
      "id": 104,
      "trashed": "/Users/prathamkumar/.Trash/IMG_4901_copy.jpg"
    }
    ```
  * `400 Bad Request`: Action error or Finder refused the Trash.

---

### 3.12. `POST /api/trash-copies`

Trashes all duplicate copies in the same group as `id`, leaving `id` untouched.

* **Headers:** `X-Neural-Gallery: 1`, `Content-Type: application/json`
* **Request Body:**
```json
{
  "id": 101
}
```
* **Response Status:**
  * `200 OK`:
    ```json
    {
      "trashed": 2,
      "failed": 0
    }
    ```

---

### 3.13. `POST /api/move`

Relocates an indexed file to an existing destination directory.

* **Headers:** `X-Neural-Gallery: 1`, `Content-Type: application/json`
* **Request Body:**
```json
{
  "id": 101,
  "destination": "/Users/prathamkumar/Pictures/Kept"
}
```
* **Response Status:**
  * `200 OK`:
    ```json
    {
      "id": 101,
      "path": "/Users/prathamkumar/Pictures/Kept/IMG_4901.jpg"
    }
    ```
  * `400 Bad Request`: Target folder does not exist or invalid path.

---

### 3.14. `POST /api/reveal`

Highlights the file in macOS Finder using `open -R <path>`.

* **Headers:** `X-Neural-Gallery: 1`, `Content-Type: application/json`
* **Request Body:**
```json
{
  "id": 101
}
```
* **Response Status:** `200 OK`: `{"id": 101}`

---

## 4. PyWebView Desktop Bridge (`DesktopApi`)

When operating in desktop mode (`neural-gallery app`), JavaScript accesses native platform methods via `window.pywebview.api`:

```javascript
// Open native macOS folder chooser
const selectedPath = await window.pywebview.api.choose_folder();

// Initiate window drag from custom background area
window.pywebview.api.begin_drag();

// Toggle text entry mode so arrow keys do not change photos
window.pywebview.api.set_typing(true);
```

| Python Method (`DesktopApi`) | JavaScript Invocation | Return Value | Description |
| :--- | :--- | :--- | :--- |
| `choose_folder(self)` | `window.pywebview.api.choose_folder()` | `Promise<string>` | Triggers native Cocoa `NSOpenPanel` folder picker dialog. Returns absolute path or empty string if canceled. |
| `begin_drag(self)` | `window.pywebview.api.begin_drag()` | `Promise<void>` | Invokes `NSWindow.performWindowDragWithEvent_()` from last captured mousedown. |
| `set_typing(self, on: bool)` | `window.pywebview.api.set_typing(boolean)` | `Promise<void>` | Toggles internal state flag `_text_entry["on"]`. When true, desktop arrow key interceptor does not hijack `Left`/`Right` arrow keys. |

