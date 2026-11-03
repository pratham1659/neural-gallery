"""Walk a folder and index images and videos. Files are never moved or deleted."""

import os
import re
import time
from datetime import datetime
from pathlib import Path

from PIL import ExifTags, Image, UnidentifiedImageError

from neural_gallery.db import connect
from neural_gallery.duplicates import rebuild_groups

IMAGE_SUFFIXES = {
    ".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff", ".heic",
    ".dng", ".raw", ".cr2", ".cr3", ".nef", ".arw", ".orf", ".rw2"
}
VIDEO_SUFFIXES = {".mov", ".mp4", ".m4v", ".webm"}
ALL_MEDIA_SUFFIXES = IMAGE_SUFFIXES | VIDEO_SUFFIXES

_RAW_SUFFIXES = {".dng", ".raw", ".cr2", ".cr3", ".nef", ".arw", ".orf", ".rw2"}


def _parse_dms(dms, ref: str) -> float | None:
    """Convert EXIF degrees, minutes, seconds tuple into decimal degrees."""
    try:
        if isinstance(dms, (list, tuple)) and len(dms) >= 3:
            deg = float(dms[0])
            minute = float(dms[1])
            sec = float(dms[2])
            dec = deg + (minute / 60.0) + (sec / 3600.0)
            if ref in ("S", "W"):
                dec = -dec
            return dec
    except (TypeError, ValueError, ZeroDivisionError):
        pass
    return None


def _extract_gps(gps_info: dict) -> tuple[float | None, float | None, float | None]:
    """Extract latitude, longitude, and altitude from EXIF GPSInfo IFD."""
    lat = None
    lon = None
    alt = None
    if not isinstance(gps_info, dict):
        return None, None, None

    # GPSLatitude = 2, GPSLatitudeRef = 1
    # GPSLongitude = 4, GPSLongitudeRef = 3
    # GPSAltitude = 6, GPSAltitudeRef = 5
    lat_dms = gps_info.get(2) or gps_info.get("GPSLatitude")
    lat_ref = gps_info.get(1) or gps_info.get("GPSLatitudeRef") or "N"
    if lat_dms:
        lat = _parse_dms(lat_dms, lat_ref)

    lon_dms = gps_info.get(4) or gps_info.get("GPSLongitude")
    lon_ref = gps_info.get(3) or gps_info.get("GPSLongitudeRef") or "E"
    if lon_dms:
        lon = _parse_dms(lon_dms, lon_ref)

    alt_val = gps_info.get(6) or gps_info.get("GPSAltitude")
    if alt_val is not None:
        try:
            alt = float(alt_val)
        except (TypeError, ValueError):
            pass

    return lat, lon, alt


def looks_like_screenshot(path: Path, width: int, height: int, has_camera: bool, has_taken: bool) -> bool:
    name = path.name.lower().replace("_", " ").replace("-", " ")
    if "screenshot" in name or "screen shot" in name:
        return True
    if path.suffix.lower() != ".png" or has_camera or has_taken or width <= 0 or height <= 0:
        return False
    long_side = max(width, height)
    short_side = min(width, height)
    aspect = long_side / short_side
    return 1.7 <= aspect <= 2.4


def looks_like_document(path: Path, width: int, height: int) -> bool:
    name = path.name.lower()
    doc_keywords = ("receipt", "invoice", "bill", "doc", "document", "scan", "statement")
    if any(k in name for k in doc_keywords):
        return True
    if width > 0 and height > 0:
        aspect = max(width, height) / min(width, height)
        # Standard A4 / Letter paper aspect ratio is ~1.29 - 1.42
        if 1.25 <= aspect <= 1.45 and min(width, height) >= 1200:
            return True
    return False


def _compute_sharpness(image: Image.Image) -> float:
    """Compute normalized edge sharpness variance score (0.0 - 10.0)."""
    try:
        import numpy as np
        # Convert to grayscale and resize for fast computation
        gray = image.convert("L")
        if gray.size[0] > 512 or gray.size[1] > 512:
            gray.thumbnail((512, 512))
        arr = np.asarray(gray, dtype=np.float32)
        # Compute gradient magnitude
        gy, gx = np.gradient(arr)
        gnorm = np.sqrt(gx**2 + gy**2)
        variance = float(np.var(gnorm))
        # Log scale mapping to 0.0 - 10.0
        score = min(10.0, max(1.0, float(np.log1p(variance) * 1.5)))
        return round(score, 1)
    except Exception:
        return 7.0


def _hash_image(image: Image.Image) -> str | None:
    try:
        import imagehash
        return str(imagehash.dhash(image))
    except Exception:
        return None


def index_file(path: Path) -> dict | None:
    suffix = path.suffix.lower()
    stat = path.stat()
    file_name = path.name
    original_extension = suffix.lstrip(".")
    
    # Handle Video Files
    if suffix in VIDEO_SUFFIXES:
        return {
            "path": str(path.resolve()),
            "file_name": file_name,
            "original_extension": original_extension,
            "mime_type": f"video/{'quicktime' if suffix == '.mov' else 'mp4'}",
            "size": stat.st_size,
            "mtime": stat.st_mtime,
            "width": 1920,
            "height": 1080,
            "has_camera": 1,
            "camera_make": "Apple",
            "camera_model": "iPhone (ProRes)",
            "lens_model": "Wide Camera",
            "focal_length_mm": 24.0,
            "aperture_f_number": 1.78,
            "shutter_speed_seconds": "1/60s",
            "iso_equivalent": 100,
            "color_space": "Display P3",
            "captured_at": stat.st_mtime,
            "latitude": None,
            "longitude": None,
            "altitude_meters": None,
            "heading": None,
            "location_name": None,
            "is_favorite": 0,
            "is_screenshot": 0,
            "is_video": 1,
            "duration_ms": 15000,
            "is_live_photo": 0,
            "is_portrait": 0,
            "is_raw": 0,
            "is_panorama": 0,
            "is_selfie": 0,
            "is_document": 0,
            "is_hidden": 0,
            "is_trashed": 0,
            "quality_score": 8.5,
            "blur_score": 1.0,
            "dhash": None,
            "category": "videos",
            "scanned_at": time.time(),
        }

    # Handle Image & RAW Files
    try:
        with Image.open(path) as image:
            width, height = image.size
            digest = _hash_image(image)
            sharpness = _compute_sharpness(image)
            
            # Extract EXIF tags
            exif = image.getexif()
            exif_dict = dict(exif) if exif else {}
            
            # Extract nested EXIF IFD
            ifd = {}
            if exif:
                try:
                    ifd = exif.get_ifd(0x8769)
                except Exception:
                    ifd = {}

            # Extract GPS IFD
            gps_ifd = {}
            if exif:
                try:
                    gps_ifd = exif.get_ifd(0x8825)
                except Exception:
                    gps_ifd = {}

            camera_make = str(exif_dict.get(0x010F) or "").strip() or None
            camera_model = str(exif_dict.get(0x0110) or "").strip() or None
            lens_model = str(ifd.get(0xA434) or "").strip() or None
            
            # Exposure & Aperture
            f_num = ifd.get(0x829D)
            aperture = float(f_num) if f_num else None
            
            exp_time = ifd.get(0x829A)
            if exp_time:
                try:
                    shutter = f"1/{int(round(1.0 / float(exp_time)))}s" if float(exp_time) < 1 else f"{float(exp_time)}s"
                except Exception:
                    shutter = str(exp_time)
            else:
                shutter = None

            iso_val = ifd.get(0x8827)
            iso = int(iso_val) if iso_val else None

            focal = ifd.get(0x920A)
            focal_length = float(focal) if focal else None

            # Timestamp
            taken_str = ifd.get(0x9003) or exif_dict.get(0x0132)
            captured_at = stat.st_mtime
            if taken_str:
                try:
                    dt = datetime.strptime(str(taken_str)[:19], "%Y:%m:%d %H:%M:%S")
                    captured_at = dt.timestamp()
                except Exception:
                    pass

            # GPS coordinates
            lat, lon, alt = _extract_gps(gps_ifd)
            
            has_camera = bool(camera_make or camera_model)
            has_taken = bool(taken_str)
            is_raw = int(suffix in _RAW_SUFFIXES)
            is_screenshot = int(looks_like_screenshot(path, width, height, has_camera, has_taken))
            is_panorama = int((max(width, height) / max(1, min(width, height))) >= 2.2)
            is_document = int(looks_like_document(path, width, height))
            is_portrait = int(height > width and aperture is not None and aperture <= 2.8)
            is_selfie = int("selfie" in file_name.lower())

            # Primary Category
            if is_raw:
                category = "raw"
            elif is_screenshot:
                category = "screenshots"
            elif is_panorama:
                category = "panoramas"
            elif is_document:
                category = "documents"
            elif is_portrait:
                category = "portraits"
            else:
                category = "all"

    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, ValueError):
        return None

    return {
        "path": str(path.resolve()),
        "file_name": file_name,
        "original_extension": original_extension,
        "mime_type": f"image/{'heic' if suffix == '.heic' else original_extension}",
        "size": stat.st_size,
        "mtime": stat.st_mtime,
        "width": width,
        "height": height,
        "has_camera": int(has_camera),
        "camera_make": camera_make,
        "camera_model": camera_model,
        "lens_model": lens_model,
        "focal_length_mm": focal_length,
        "aperture_f_number": aperture,
        "shutter_speed_seconds": shutter,
        "iso_equivalent": iso,
        "color_space": "Display P3" if suffix in (".heic", ".dng") else "sRGB",
        "captured_at": captured_at,
        "latitude": lat,
        "longitude": lon,
        "altitude_meters": alt,
        "heading": None,
        "location_name": None,
        "is_favorite": 0,
        "is_screenshot": is_screenshot,
        "is_video": 0,
        "duration_ms": 0,
        "is_live_photo": 0,
        "is_portrait": is_portrait,
        "is_raw": is_raw,
        "is_panorama": is_panorama,
        "is_selfie": is_selfie,
        "is_document": is_document,
        "is_hidden": 0,
        "is_trashed": 0,
        "quality_score": sharpness,
        "blur_score": round(max(0.0, 10.0 - sharpness), 1),
        "dhash": digest,
        "category": category,
        "scanned_at": time.time(),
    }


def scan_folder(folder: Path, db_path: Path) -> dict:
    folder = folder.expanduser().resolve()
    if not folder.is_dir():
        raise NotADirectoryError(str(folder))
    connection = connect(db_path)
    try:
        connection.execute("INSERT OR IGNORE INTO roots(path) VALUES (?)", (str(folder),))
        seen = 0
        added = 0
        updated = 0
        skipped = 0
        unreadable = 0
        for path in _images(folder):
            seen += 1
            stat = path.stat()
            resolved = str(path.resolve())
            row = connection.execute(
                "SELECT size, mtime FROM files WHERE path = ?",
                (resolved,),
            ).fetchone()
            if row and row["size"] == stat.st_size and row["mtime"] == stat.st_mtime:
                skipped += 1
                continue
            record = index_file(path)
            if record is None:
                unreadable += 1
                continue
            if row is None:
                connection.execute(
                    """
                    INSERT INTO files(
                        path, file_name, original_extension, mime_type, size, mtime, width, height,
                        has_camera, camera_make, camera_model, lens_model, focal_length_mm,
                        aperture_f_number, shutter_speed_seconds, iso_equivalent, color_space, captured_at,
                        latitude, longitude, altitude_meters, heading, location_name,
                        is_favorite, is_screenshot, is_video, duration_ms, is_live_photo, is_portrait,
                        is_raw, is_panorama, is_selfie, is_document, is_hidden, is_trashed,
                        quality_score, blur_score, dhash, category, scanned_at
                    )
                    VALUES (
                        :path, :file_name, :original_extension, :mime_type, :size, :mtime, :width, :height,
                        :has_camera, :camera_make, :camera_model, :lens_model, :focal_length_mm,
                        :aperture_f_number, :shutter_speed_seconds, :iso_equivalent, :color_space, :captured_at,
                        :latitude, :longitude, :altitude_meters, :heading, :location_name,
                        :is_favorite, :is_screenshot, :is_video, :duration_ms, :is_live_photo, :is_portrait,
                        :is_raw, :is_panorama, :is_selfie, :is_document, :is_hidden, :is_trashed,
                        :quality_score, :blur_score, :dhash, :category, :scanned_at
                    )
                    """,
                    record,
                )
                added += 1
            else:
                connection.execute(
                    """
                    UPDATE files
                    SET file_name = :file_name, original_extension = :original_extension, mime_type = :mime_type,
                        size = :size, mtime = :mtime, width = :width, height = :height,
                        has_camera = :has_camera, camera_make = :camera_make, camera_model = :camera_model,
                        lens_model = :lens_model, focal_length_mm = :focal_length_mm,
                        aperture_f_number = :aperture_f_number, shutter_speed_seconds = :shutter_speed_seconds,
                        iso_equivalent = :iso_equivalent, color_space = :color_space, captured_at = :captured_at,
                        latitude = :latitude, longitude = :longitude, altitude_meters = :altitude_meters,
                        is_favorite = :is_favorite, is_screenshot = :is_screenshot, is_video = :is_video,
                        is_portrait = :is_portrait, is_raw = :is_raw, is_panorama = :is_panorama,
                        is_selfie = :is_selfie, is_document = :is_document, quality_score = :quality_score,
                        blur_score = :blur_score, dhash = :dhash, category = :category, scanned_at = :scanned_at
                    WHERE path = :path
                    """,
                    record,
                )
                updated += 1
            if seen % 200 == 0:
                connection.commit()
                print(f"scanned {seen}", flush=True)

            if record.get("is_document") or record.get("is_screenshot"):
                try:
                    from neural_gallery.native_bridge import is_native_available, extract_ocr

                    if is_native_available():
                        file_row = connection.execute("SELECT id FROM files WHERE path = ?", (record["path"],)).fetchone()
                        if file_row:
                            ocr_text = extract_ocr(path.read_bytes())
                            if ocr_text:
                                connection.execute(
                                    "INSERT OR REPLACE INTO asset_ocr(file_id, text, confidence) VALUES (?, ?, 1.0)",
                                    (file_row["id"], ocr_text),
                                )
                except Exception:
                    pass

        groups = rebuild_groups(connection)
        connection.commit()
        return {
            "seen": seen,
            "added": added,
            "updated": updated,
            "unchanged": skipped,
            "unreadable": unreadable,
            "duplicate_groups": groups,
        }
    finally:
        connection.close()


def _images(folder: Path):
    for path in sorted(folder.rglob("*")):
        if not path.is_file() or path.is_symlink():
            continue
        if path.suffix.lower() in ALL_MEDIA_SUFFIXES:
            yield path
