"""On-device face and pet grouping with Apple's Vision framework.

Faces and pet detections never leave this Mac. A group means two face crops look
alike to Vision's image feature print. It is an on-device hint you can name.
"""

import io
import sqlite3
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

# Cosine distance. Lower is more alike.
MATCH_DISTANCE = 0.34


def crop_box(width: int, height: int, x: float, y: float, w: float, h: float, pad: float = 0.25):
    """Vision boxes are normalized with a bottom-left origin. Return a pixel box."""
    pixel_w = max(1, int(w * width))
    pixel_h = max(1, int(h * height))
    left = int(x * width)
    top = int((1.0 - y - h) * height)
    grow_x = int(pixel_w * pad)
    grow_y = int(pixel_h * pad)
    left = max(0, left - grow_x)
    top = max(0, top - grow_y)
    right = min(width, left + pixel_w + grow_x * 2)
    bottom = min(height, top + pixel_h + grow_y * 2)
    if right <= left or bottom <= top:
        return None
    return left, top, right, bottom


def _feature_print(image: Image.Image) -> np.ndarray | None:
    try:
        import Vision
        from Foundation import NSData

        buffer = io.BytesIO()
        image.convert("RGB").save(buffer, format="JPEG", quality=90)
        data = NSData.dataWithBytes_length_(buffer.getvalue(), len(buffer.getvalue()))
        request = Vision.VNGenerateImageFeaturePrintRequest.alloc().init()
        handler = Vision.VNImageRequestHandler.alloc().initWithData_options_(data, None)
        ok, _error = handler.performRequests_error_([request], None)
        if not ok:
            return None
        results = request.results() or []
        if not results:
            return None
        observation = results[0]
        raw = bytes(observation.data())
        count = int(observation.elementCount())
        if count <= 0 or len(raw) < count * 4:
            return None
        vector = np.frombuffer(raw[: count * 4], dtype="<f4").astype(np.float32)
        norm = float(np.linalg.norm(vector))
        if norm == 0:
            return None
        return vector / norm
    except Exception:
        return None


def _detect_boxes(path: Path) -> list[tuple[float, float, float, float]]:
    """Detect human faces using Apple Vision (via native Swift bridge or PyObjC)."""
    try:
        from neural_gallery.native_bridge import is_native_available, detect_faces

        if is_native_available():
            data = path.read_bytes()
            faces = detect_faces(data)
            if faces:
                return [(f["x"], f["y"], f["w"], f["h"]) for f in faces]
    except Exception:
        pass

    try:
        import Vision
        from Foundation import NSURL

        url = NSURL.fileURLWithPath_(str(path))
        request = Vision.VNDetectFaceRectanglesRequest.alloc().init()
        handler = Vision.VNImageRequestHandler.alloc().initWithURL_options_(url, None)
        ok, _error = handler.performRequests_error_([request], None)
        if not ok:
            return []
        boxes = []
        for face in request.results() or []:
            box = face.boundingBox()
            boxes.append((float(box.origin.x), float(box.origin.y), float(box.size.width), float(box.size.height)))
        return boxes
    except Exception:
        return []


def _detect_animals(path: Path) -> list[tuple[float, float, float, float, str, float]]:
    """Detect pets (dogs, cats) using Apple Vision (via native Swift bridge or PyObjC)."""
    try:
        from neural_gallery.native_bridge import is_native_available, detect_animals

        if is_native_available():
            data = path.read_bytes()
            animals = detect_animals(data)
            if animals:
                return [
                    (a["x"], a["y"], a["w"], a["h"], a.get("label", "pet"), a.get("confidence", 0.95))
                    for a in animals
                ]
    except Exception:
        pass

    try:
        import Vision
        from Foundation import NSURL

        if not hasattr(Vision, "VNRecognizeAnimalsRequest"):
            return []

        url = NSURL.fileURLWithPath_(str(path))
        request = Vision.VNRecognizeAnimalsRequest.alloc().init()
        handler = Vision.VNImageRequestHandler.alloc().initWithURL_options_(url, None)
        ok, _error = handler.performRequests_error_([request], None)
        if not ok:
            return []

        results = []
        for animal in request.results() or []:
            box = animal.boundingBox()
            labels = animal.labels() or []
            label_name = "pet"
            confidence = float(animal.confidence()) if hasattr(animal, "confidence") else 0.95
            if labels:
                top_label = str(labels[0].identifier()).lower()
                if "dog" in top_label:
                    label_name = "dog"
                elif "cat" in top_label:
                    label_name = "cat"
            results.append((
                float(box.origin.x), float(box.origin.y),
                float(box.size.width), float(box.size.height),
                label_name, confidence
            ))
        return results
    except Exception:
        return []


def index_faces(path: Path) -> list[dict]:
    human_boxes = _detect_boxes(path)
    animal_boxes = _detect_animals(path)
    if not human_boxes and not animal_boxes:
        return []

    found = []
    try:
        with Image.open(path) as image:
            oriented = ImageOps.exif_transpose(image)
            width, height = oriented.size

            # Human Faces
            for x, y, w, h in human_boxes:
                pixels = crop_box(width, height, x, y, w, h)
                if pixels is None:
                    continue
                crop = oriented.crop(pixels)
                if min(crop.size) < 24:
                    continue
                feature = _feature_print(crop)
                if feature is None:
                    continue
                found.append({
                    "x": x,
                    "y": y,
                    "w": w,
                    "h": h,
                    "feature": feature.tobytes(),
                    "is_pet": 0,
                    "pet_type": None,
                    "confidence": 0.99,
                })

            # Pets & Animals
            for x, y, w, h, pet_type, conf in animal_boxes:
                pixels = crop_box(width, height, x, y, w, h)
                if pixels is None:
                    continue
                crop = oriented.crop(pixels)
                if min(crop.size) < 24:
                    continue
                feature = _feature_print(crop)
                if feature is None:
                    continue
                found.append({
                    "x": x,
                    "y": y,
                    "w": w,
                    "h": h,
                    "feature": feature.tobytes(),
                    "is_pet": 1,
                    "pet_type": pet_type,
                    "confidence": conf,
                })
    except Exception:
        return []

    return found


def scan_faces(db_path: Path, progress=print) -> dict:
    from neural_gallery.access import allowed_file
    from neural_gallery.db import connect

    connection = connect(db_path)
    added = 0
    photos = 0
    failed = 0
    try:
        rows = connection.execute(
            "SELECT id FROM files WHERE faces_scanned = 0 ORDER BY id"
        ).fetchall()
        total = len(rows)
        for index, row in enumerate(rows, start=1):
            path = allowed_file(connection, row["id"])
            photos += 1
            try:
                faces = index_faces(path) if path is not None else []
            except (OSError, ValueError):
                faces = []
                failed += 1
            connection.execute("DELETE FROM faces WHERE file_id = ?", (row["id"],))
            for face in faces:
                connection.execute(
                    """
                    INSERT INTO faces(file_id, x, y, w, h, feature, confidence)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (row["id"], face["x"], face["y"], face["w"], face["h"], face["feature"], face.get("confidence", 1.0)),
                )
                added += 1
            connection.execute(
                "UPDATE files SET faces_scanned = 1 WHERE id = ?",
                (row["id"],),
            )
            if index % 25 == 0:
                connection.commit()
                progress(f"faces {index}/{total}, found {added}")
        grouped = assign_people(connection)
        connection.commit()
        return {"photos": photos, "faces": added, "failed": failed, "people": grouped}
    finally:
        connection.close()


def assign_people(connection: sqlite3.Connection, threshold: float = MATCH_DISTANCE) -> int:
    rows = connection.execute(
        "SELECT id, feature, person_key FROM faces WHERE feature IS NOT NULL"
    ).fetchall()
    if not rows:
        return 0
    vectors = []
    ids = []
    keys = []
    for row in rows:
        vector = np.frombuffer(row["feature"], dtype=np.float32)
        norm = float(np.linalg.norm(vector))
        if norm == 0 or vector.size < 8:
            continue
        vectors.append(vector / norm)
        ids.append(row["id"])
        keys.append(row["person_key"])
    if not vectors:
        return 0
    matrix = np.vstack(vectors)
    centroids: dict[str, np.ndarray] = {}
    counts: dict[str, int] = {}
    for key, vector in zip(keys, matrix):
        if not key:
            continue
        if key in centroids:
            counts[key] += 1
            centroids[key] += (vector - centroids[key]) / counts[key]
        else:
            centroids[key] = vector.copy()
            counts[key] = 1

    def new_key(face_id: int) -> str:
        return f"p{face_id}"

    for face_id, vector, key in zip(ids, matrix, keys):
        if key:
            continue
        best_key = None
        best_distance = threshold
        for person_key, centroid in centroids.items():
            distance = 1.0 - float(np.dot(vector, centroid))
            if distance <= best_distance:
                best_distance = distance
                best_key = person_key
        if best_key is None:
            best_key = new_key(face_id)
            centroids[best_key] = vector.copy()
            counts[best_key] = 1
        else:
            counts[best_key] += 1
            centroids[best_key] += (vector - centroids[best_key]) / counts[best_key]
        connection.execute(
            "UPDATE faces SET person_key = ? WHERE id = ?",
            (best_key, face_id),
        )
    grouped = connection.execute(
        """
        SELECT COUNT(*) FROM (
            SELECT person_key FROM faces
            WHERE person_key IS NOT NULL
            GROUP BY person_key
            HAVING COUNT(*) >= 2
        )
        """
    ).fetchone()[0]
    return int(grouped)


def list_people(connection: sqlite3.Connection) -> list[dict]:
    rows = connection.execute(
        """
        SELECT faces.person_key AS person_key,
               COUNT(*) AS face_count,
               COUNT(DISTINCT faces.file_id) AS photo_count,
               MIN(faces.file_id) AS sample_id,
               people.name AS name,
               COALESCE(people.is_favorite, 0) AS is_favorite,
               COALESCE(people.is_pet, 0) AS is_pet,
               people.pet_type AS pet_type
        FROM faces
        LEFT JOIN people ON people.person_key = faces.person_key
        WHERE faces.person_key IS NOT NULL
        GROUP BY faces.person_key
        ORDER BY photo_count DESC, faces.person_key
        """
    ).fetchall()
    return [
        {
            "person_key": row["person_key"],
            "key": row["person_key"],
            "name": row["name"] or "",
            "face_count": row["face_count"],
            "photo_count": row["photo_count"],
            "count": row["photo_count"],
            "sample_id": row["sample_id"],
            "is_favorite": bool(row["is_favorite"]),
            "is_pet": bool(row["is_pet"]),
            "pet_type": row["pet_type"],
            "avatar_url": f"/api/person/{row['person_key']}/avatar",
            "thumb": f"/api/person/{row['person_key']}/avatar",
        }
        for row in rows
    ]


def name_person(connection: sqlite3.Connection, person_key: str, name: str, is_pet: bool = False, pet_type: str = None) -> None:
    cleaned = name.strip()
    if not person_key or len(person_key) > 64 or not person_key.startswith("p"):
        raise ValueError("unknown person")
    exists = connection.execute(
        "SELECT 1 FROM faces WHERE person_key = ? LIMIT 1",
        (person_key,),
    ).fetchone()
    if exists is None:
        raise ValueError("unknown person")
    if cleaned:
        connection.execute(
            """
            INSERT INTO people(person_key, name, is_pet, pet_type)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(person_key) DO UPDATE SET
                name = excluded.name,
                is_pet = excluded.is_pet,
                pet_type = excluded.pet_type
            """,
            (person_key, cleaned[:80], int(is_pet), pet_type),
        )
    else:
        connection.execute("DELETE FROM people WHERE person_key = ?", (person_key,))


def list_candidates(connection: sqlite3.Connection, limit: int = 24) -> list[dict]:
    """Find candidate face detections that are either in unnamed clusters or need user confirmation."""
    rows = connection.execute(
        """
        SELECT faces.id, faces.file_id, faces.x, faces.y, faces.w, faces.h, faces.confidence,
               faces.person_key, files.path
        FROM faces
        JOIN files ON files.id = faces.file_id
        LEFT JOIN people ON people.person_key = faces.person_key
        WHERE (people.name IS NULL OR people.name = '')
        ORDER BY faces.confidence DESC, faces.id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [
        {
            "face_id": row["id"],
            "file_id": row["file_id"],
            "path": row["path"],
            "name": Path(row["path"]).name,
            "box": [row["x"], row["y"], row["w"], row["h"]],
            "confidence": row["confidence"],
            "person_key": row["person_key"] or f"p{row['id']}",
            "avatar_url": f"/api/face/{row['id']}/avatar",
            "thumb": f"/api/face/{row['id']}/avatar",
        }
        for row in rows
    ]


def confirm_candidate(connection: sqlite3.Connection, face_id: int, person_key: str) -> None:
    """Confirm a candidate face into a person group."""
    if not person_key or not person_key.startswith("p"):
        raise ValueError("invalid person key")
    connection.execute("UPDATE faces SET person_key = ? WHERE id = ?", (person_key, face_id))
    connection.commit()


def merge_people(connection: sqlite3.Connection, source_person_key: str, target_person_key: str) -> None:
    """Merge source person group into target person group."""
    if not source_person_key or not target_person_key:
        raise ValueError("source and target person keys required")
    if source_person_key == target_person_key:
        return
    connection.execute("UPDATE faces SET person_key = ? WHERE person_key = ?", (target_person_key, source_person_key))
    connection.execute("DELETE FROM people WHERE person_key = ?", (source_person_key,))
    connection.commit()

