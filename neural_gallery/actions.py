"""Move or trash indexed photos. Both require an indexed id and a caller confirmation."""

import shutil
import sqlite3
from pathlib import Path

from neural_gallery.access import allowed_file


class ActionError(Exception):
    pass


def forget(connection: sqlite3.Connection, file_id: int) -> None:
    group = connection.execute(
        "SELECT group_key FROM dup_groups WHERE file_id = ?",
        (file_id,),
    ).fetchone()
    connection.execute("DELETE FROM faces WHERE file_id = ?", (file_id,))
    connection.execute("DELETE FROM dup_groups WHERE file_id = ?", (file_id,))
    if group is not None:
        left = connection.execute(
            "SELECT COUNT(*) FROM dup_groups WHERE group_key = ?",
            (group["group_key"],),
        ).fetchone()[0]
        if left < 2:
            connection.execute(
                "DELETE FROM dup_groups WHERE group_key = ?",
                (group["group_key"],),
            )
    connection.execute("DELETE FROM files WHERE id = ?", (file_id,))


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


def trash_indexed(connection: sqlite3.Connection, file_id: int) -> str:
    path = allowed_file(connection, file_id)
    if path is None:
        raise ActionError("that photo is not in the index")
    trashed = trash_file(path)
    forget(connection, file_id)
    return trashed


def trash_other_copies(connection: sqlite3.Connection, file_id: int) -> dict:
    path = allowed_file(connection, file_id)
    if path is None:
        raise ActionError("that photo is not in the index")
    group = connection.execute(
        "SELECT group_key FROM dup_groups WHERE file_id = ?",
        (file_id,),
    ).fetchone()
    if group is None:
        return {"trashed": 0, "failed": 0}
    others = connection.execute(
        "SELECT file_id FROM dup_groups WHERE group_key = ? AND file_id != ?",
        (group["group_key"], file_id),
    ).fetchall()
    trashed = 0
    failed = 0
    for row in others:
        try:
            trash_indexed(connection, row["file_id"])
            trashed += 1
        except (ActionError, OSError):
            failed += 1
    return {"trashed": trashed, "failed": failed}


def move_indexed(connection: sqlite3.Connection, file_id: int, destination: Path) -> str:
    path = allowed_file(connection, file_id)
    if path is None:
        raise ActionError("that photo is not in the index")
    folder = Path(destination).expanduser().resolve()
    if not folder.is_dir():
        raise ActionError("pick an existing folder")
    target = _unique_target(folder, path.name, file_id)
    if target.resolve() == path.resolve():
        return str(path)
    shutil.move(path, target)
    stat = target.stat()
    connection.execute("INSERT OR IGNORE INTO roots(path) VALUES (?)", (str(folder),))
    connection.execute(
        "UPDATE files SET path = ?, size = ?, mtime = ? WHERE id = ?",
        (str(target.resolve()), stat.st_size, stat.st_mtime, file_id),
    )
    return str(target.resolve())


def reveal(connection: sqlite3.Connection, file_id: int) -> None:
    import subprocess

    path = allowed_file(connection, file_id)
    if path is None:
        raise ActionError("that photo is not in the index")
    subprocess.run(["open", "-R", str(path)], check=False)


def toggle_favorite(connection: sqlite3.Connection, file_id: int) -> bool:
    """Toggle is_favorite flag for an indexed photo. Returns new favorite state."""
    row = connection.execute("SELECT is_favorite FROM files WHERE id = ?", (file_id,)).fetchone()
    if row is None:
        raise ActionError("that photo is not in the index")
    new_state = 0 if row["is_favorite"] else 1
    connection.execute("UPDATE files SET is_favorite = ? WHERE id = ?", (new_state, file_id))
    connection.commit()
    return bool(new_state)


def set_category(connection: sqlite3.Connection, file_id: int, category: str) -> None:
    """Set media category tag for an indexed item."""
    exists = connection.execute("SELECT 1 FROM files WHERE id = ?", (file_id,)).fetchone()
    if exists is None:
        raise ActionError("that photo is not in the index")
    connection.execute("UPDATE files SET category = ? WHERE id = ?", (category.strip().lower(), file_id))
    connection.commit()


def toggle_hidden(connection: sqlite3.Connection, file_id: int) -> bool:
    """Toggle is_hidden flag for an indexed photo. Returns new hidden state."""
    row = connection.execute("SELECT is_hidden FROM files WHERE id = ?", (file_id,)).fetchone()
    if row is None:
        raise ActionError("that photo is not in the index")
    new_state = 0 if row["is_hidden"] else 1
    connection.execute("UPDATE files SET is_hidden = ? WHERE id = ?", (new_state, file_id))
    connection.commit()
    return bool(new_state)


def mark_trashed(connection: sqlite3.Connection, file_id: int, trashed: bool = True) -> bool:
    """Soft trash or restore an indexed photo within the vault without immediate disk deletion."""
    row = connection.execute("SELECT is_trashed FROM files WHERE id = ?", (file_id,)).fetchone()
    if row is None:
        raise ActionError("that photo is not in the index")
    state = 1 if trashed else 0
    connection.execute("UPDATE files SET is_trashed = ? WHERE id = ?", (state, file_id))
    connection.commit()
    return bool(state)


def get_photo_detail(connection: sqlite3.Connection, file_id: int) -> dict:
    """Retrieve full optical, geographic, and face metadata for a single photo."""
    row = connection.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
    if row is None:
        raise ActionError("that photo is not in the index")

    faces_rows = connection.execute(
        """
        SELECT faces.id, faces.x, faces.y, faces.w, faces.h, faces.confidence, faces.person_key,
               people.name, people.is_pet, people.pet_type
        FROM faces
        LEFT JOIN people ON people.person_key = faces.person_key
        WHERE faces.file_id = ?
        """,
        (file_id,),
    ).fetchall()
    faces = [
        {
            "id": f["id"],
            "x": f["x"],
            "y": f["y"],
            "w": f["w"],
            "h": f["h"],
            "confidence": f["confidence"],
            "person_key": f["person_key"],
            "name": f["name"] or "",
            "is_pet": bool(f["is_pet"]),
            "pet_type": f["pet_type"],
        }
        for f in faces_rows
    ]

    ocr_rows = connection.execute("SELECT text, confidence FROM asset_ocr WHERE file_id = ?", (file_id,)).fetchall()
    ocr_text = " ".join([o["text"] for o in ocr_rows if o["text"]])

    dup_group = connection.execute("SELECT group_key FROM dup_groups WHERE file_id = ?", (file_id,)).fetchone()
    dup_count = 0
    if dup_group:
        dup_count = connection.execute(
            "SELECT COUNT(*) FROM dup_groups WHERE group_key = ?",
            (dup_group["group_key"],),
        ).fetchone()[0]

    return {
        "id": row["id"],
        "path": row["path"],
        "name": Path(row["path"]).name,
        "file_name": row["file_name"] or Path(row["path"]).name,
        "original_extension": row["original_extension"] or Path(row["path"]).suffix.lstrip(".").lower(),
        "mime_type": row["mime_type"] or "",
        "width": row["width"],
        "height": row["height"],
        "size": row["size"],
        "mtime": row["mtime"],
        "created_at": row["captured_at"] if row["captured_at"] else row["mtime"],
        "is_favorite": bool(row["is_favorite"]),
        "is_video": bool(row["is_video"]),
        "is_screenshot": bool(row["is_screenshot"]),
        "is_raw": bool(row["is_raw"]),
        "is_portrait": bool(row["is_portrait"]),
        "is_live_photo": bool(row["is_live_photo"]),
        "is_hidden": bool(row["is_hidden"]),
        "is_trashed": bool(row["is_trashed"]),
        "is_imported": bool(row["is_imported"]),
        "camera_make": row["camera_make"] or "",
        "camera_model": row["camera_model"] or "",
        "lens_model": row["lens_model"] or "",
        "focal_length": f"{row['focal_length_mm']}mm" if row["focal_length_mm"] else "",
        "f_number": f"ƒ/{row['aperture_f_number']}" if row["aperture_f_number"] else "",
        "exposure_time": str(row["shutter_speed_seconds"] or ""),
        "iso": str(row["iso_equivalent"] or ""),
        "color_space": row["color_space"] or "",
        "latitude": row["latitude"],
        "longitude": row["longitude"],
        "altitude": row["altitude_meters"],
        "city": row["location_name"] or "",
        "country": "",
        "quality_score": row["quality_score"],
        "blur_score": row["blur_score"],
        "label": row["label"],
        "category": row["category"],
        "faces": faces,
        "ocr_text": ocr_text,
        "dup_count": dup_count,
    }


def _unique_target(folder: Path, name: str, file_id: int) -> Path:
    candidate = folder / name
    if not candidate.exists():
        return candidate
    stem = Path(name).stem
    suffix = Path(name).suffix
    return folder / f"{stem}-{file_id}{suffix}"


def auto_sort_imported_photo(connection: sqlite3.Connection, file_id: int) -> str:
    """
    Mark an imported photo as saved (is_imported=0, label='keep') and classify it
    into its natural library category based on media attributes, optical metadata,
    and face/OCR detections.
    """
    row = connection.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
    if row is None:
        raise ActionError("that photo is not in the index")

    path_str = (row["path"] or "").lower()
    cat = "all"

    if row["is_screenshot"]:
        if row["is_video"]:
            cat = "screen-recordings"
        else:
            cat = "screenshots"
    elif row["is_video"]:
        if "slomo" in path_str or "slow" in path_str:
            cat = "slomo"
        elif "timelapse" in path_str or "time-lapse" in path_str:
            cat = "timelapse"
        elif "prores" in path_str or "quicktime" in (row["mime_type"] or "").lower():
            cat = "prores"
        else:
            cat = "videos"
    elif row["is_raw"]:
        cat = "raw"
    elif row["is_portrait"]:
        cat = "portraits"
    elif row["is_live_photo"]:
        cat = "live-photos"
    elif row["width"] and row["height"] and (float(row["width"]) / max(1.0, float(row["height"]))) >= 2.2:
        cat = "panoramas"
    elif row["is_document"]:
        cat = "documents"
    else:
        has_ocr = connection.execute("SELECT 1 FROM asset_ocr WHERE file_id = ?", (file_id,)).fetchone()
        if has_ocr:
            cat = "documents"
        else:
            faces = connection.execute(
                "SELECT is_pet FROM faces LEFT JOIN people ON people.person_key = faces.person_key WHERE file_id = ?",
                (file_id,),
            ).fetchall()
            if any(f["is_pet"] for f in faces if f["is_pet"] is not None):
                cat = "pets"
            elif len(faces) == 1:
                cat = "selfies"
            elif len(faces) > 1:
                cat = "people"
            elif row["latitude"] is not None:
                cat = "travel"

    connection.execute(
        "UPDATE files SET is_imported = 0, label = 'keep', category = ? WHERE id = ?",
        (cat, file_id),
    )
    connection.commit()
    return cat


def save_imported_photos(connection: sqlite3.Connection, file_ids: list[int]) -> dict:
    results = {}
    for fid in file_ids:
        try:
            cat = auto_sort_imported_photo(connection, fid)
            results[fid] = cat
        except Exception:
            pass
    return {"saved": len(results), "categories": results}

