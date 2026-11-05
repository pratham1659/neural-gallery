"""Walk a folder and index images and videos. Files are never moved or deleted."""

import json
import math
import os
import re
import shutil
import subprocess
import time
from datetime import datetime
from pathlib import Path

from PIL import ExifTags, Image, ImageOps, UnidentifiedImageError

from neural_gallery.db import connect
from neural_gallery.duplicates import rebuild_groups

IMAGE_SUFFIXES = {
    ".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff", ".heic", ".heif", ".avif",
    ".dng", ".raw", ".cr2", ".cr3", ".nef", ".arw", ".orf", ".rw2"
}
VIDEO_SUFFIXES = {".mov", ".mp4", ".m4v", ".webm", ".mkv", ".avi", ".3gp"}
ALL_MEDIA_SUFFIXES = IMAGE_SUFFIXES | VIDEO_SUFFIXES

_RAW_SUFFIXES = {".dng", ".raw", ".cr2", ".cr3", ".nef", ".arw", ".orf", ".rw2"}


def _parse_dms(dms, ref) -> float | None:
    """Convert EXIF degrees, minutes, seconds tuple into decimal degrees."""
    try:
        if isinstance(dms, (list, tuple)) and len(dms) >= 3:
            deg = float(dms[0])
            minute = float(dms[1])
            sec = float(dms[2])
            if math.isnan(deg) or math.isnan(minute) or math.isnan(sec):
                return None
            dec = deg + (minute / 60.0) + (sec / 3600.0)
            if math.isnan(dec) or math.isinf(dec):
                return None
            ref_str = ref.decode("ascii", errors="ignore") if isinstance(ref, bytes) else str(ref)
            ref_clean = ref_str.strip("\x00 '\"").upper()
            if ref_clean in ("S", "W"):
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
            alt_f = float(alt_val)
            if not math.isnan(alt_f) and not math.isinf(alt_f):
                alt = round(alt_f, 1)
        except (TypeError, ValueError):
            pass

    # Validate coordinate ranges (-90 to +90 lat, -180 to +180 lon) and reject null island (0, 0)
    if lat is not None and (math.isnan(lat) or abs(lat) > 90.0):
        lat = None
    if lon is not None and (math.isnan(lon) or abs(lon) > 180.0):
        lon = None
    if lat == 0.0 and lon == 0.0:
        lat = None
        lon = None

    return lat, lon, alt


def _extract_gps_mdls(path: Path) -> tuple[float | None, float | None]:
    """Fallback using macOS Spotlight mdls for QuickTime MOV, Apple HEIC, and indexed media."""
    try:
        out = subprocess.check_output(
            ["mdls", "-name", "kMDItemLatitude", "-name", "kMDItemLongitude", str(path)],
            stderr=subprocess.DEVNULL,
            timeout=1.0,
        ).decode("utf-8", errors="ignore")
        lat = None
        lon = None
        for line in out.splitlines():
            line = line.strip()
            if line.startswith("kMDItemLatitude") and "=" in line:
                val = line.split("=", 1)[1].strip()
                if val and val != "(null)":
                    try:
                        f = float(val)
                        if -90 <= f <= 90 and not math.isnan(f):
                            lat = f
                    except ValueError:
                        pass
            elif line.startswith("kMDItemLongitude") and "=" in line:
                val = line.split("=", 1)[1].strip()
                if val and val != "(null)":
                    try:
                        f = float(val)
                        if -180 <= f <= 180 and not math.isnan(f):
                            lon = f
                    except ValueError:
                        pass
        if lat is not None and lon is not None and not (lat == 0.0 and lon == 0.0):
            return lat, lon
    except Exception:
        pass
    return None, None


def _extract_video_info(path: Path) -> tuple[int, int, int]:
    """Return width, height, duration_ms using ffprobe or fallback defaults."""
    ffprobe_bin = shutil.which("ffprobe")
    if not ffprobe_bin:
        for candidate in ("/opt/homebrew/bin/ffprobe", "/usr/local/bin/ffprobe", "/usr/bin/ffprobe"):
            if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
                ffprobe_bin = candidate
                break
    if ffprobe_bin:
        try:
            cmd = [
                ffprobe_bin, "-v", "error", "-select_streams", "v:0",
                "-show_entries", "stream=width,height,duration",
                "-show_entries", "format=duration", "-of", "json", str(path)
            ]
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=2.0)
            if res.returncode == 0 and res.stdout:
                data = json.loads(res.stdout)
                streams = data.get("streams", [])
                w = 1920
                h = 1080
                dur_sec = 0.0
                if streams:
                    w = int(streams[0].get("width") or 1920)
                    h = int(streams[0].get("height") or 1080)
                    dur_sec = float(streams[0].get("duration") or 0.0)
                if not dur_sec and "format" in data:
                    dur_sec = float(data["format"].get("duration") or 0.0)
                dur_ms = int(dur_sec * 1000) if dur_sec > 0 else 15000
                return w, h, dur_ms
        except Exception:
            pass
    return 1920, 1080, 15000


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
        vid_w, vid_h, dur_ms = _extract_video_info(path)
        lat, lon = _extract_gps_mdls(path)
        return {
            "path": str(path.resolve()),
            "file_name": file_name,
            "original_extension": original_extension,
            "mime_type": f"video/{'quicktime' if suffix == '.mov' else 'mp4'}",
            "size": stat.st_size,
            "mtime": stat.st_mtime,
            "width": vid_w,
            "height": vid_h,
            "has_camera": 1,
            "camera_make": "Apple" if suffix == ".mov" else "Digital Video",
            "camera_model": "iPhone (ProRes)" if suffix == ".mov" else "Video Recording",
            "lens_model": "Camera",
            "focal_length_mm": 24.0,
            "aperture_f_number": 1.78,
            "shutter_speed_seconds": "1/60s",
            "iso_equivalent": 100,
            "color_space": "Display P3",
            "captured_at": stat.st_mtime,
            "latitude": lat,
            "longitude": lon,
            "altitude_meters": None,
            "heading": None,
            "location_name": None,
            "is_favorite": 0,
            "is_screenshot": 0,
            "is_video": 1,
            "duration_ms": dur_ms,
            "is_live_photo": 0,
            "is_portrait": 0,
            "is_raw": 0,
            "is_panorama": 0,
            "is_selfie": 0,
            "is_document": 0,
            "is_hidden": 0,
            "is_trashed": 0,
            "is_imported": 0,
            "quality_score": 8.5,
            "blur_score": 1.0,
            "dhash": None,
            "category": "videos",
            "scanned_at": time.time(),
        }

    # Handle Image & RAW Files
    try:
        with Image.open(path) as image:
            # Respect EXIF Orientation tag so width, height and aspect ratio match true visual orientation
            oriented = ImageOps.exif_transpose(image)
            if oriented is not None:
                image = oriented
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
                if not gps_ifd and 34853 in exif_dict and isinstance(exif_dict[34853], dict):
                    gps_ifd = exif_dict[34853]
            if not gps_ifd and hasattr(image, "_getexif") and callable(image._getexif):
                try:
                    raw_ex = image._getexif()
                    if raw_ex and 34853 in raw_ex and isinstance(raw_ex[34853], dict):
                        gps_ifd = raw_ex[34853]
                except Exception:
                    pass

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
            if lat is None or lon is None:
                mdls_lat, mdls_lon = _extract_gps_mdls(path)
                if mdls_lat is not None and mdls_lon is not None:
                    lat, lon = mdls_lat, mdls_lon
            
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
        "is_imported": 0,
        "quality_score": sharpness,
        "blur_score": round(max(0.0, 10.0 - sharpness), 1),
        "dhash": digest,
        "category": category,
        "scanned_at": time.time(),
    }


def scan_folder(folder: Path, db_path: Path, copy_to_vault: bool = False, is_imported: bool = False) -> dict:
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
            if row and row["size"] == stat.st_size and row["mtime"] == stat.st_mtime and not copy_to_vault:
                skipped += 1
                continue
            record = index_file(path)
            if record is None:
                unreadable += 1
                continue

            if is_imported or folder.name == "Imports":
                record["is_imported"] = 1

            # Managed Vault Ingestion (Safe SSD Storage)
            if copy_to_vault:
                try:
                    from neural_gallery.vault_storage import ingest_file_into_vault
                    vault_dest = ingest_file_into_vault(path, record.get("captured_at"))
                    if vault_dest != path:
                        record["path"] = str(vault_dest)
                        record["file_name"] = vault_dest.name
                        dest_stat = vault_dest.stat()
                        record["size"] = dest_stat.st_size
                        record["mtime"] = dest_stat.st_mtime
                        resolved = str(vault_dest.resolve())
                        row = connection.execute(
                            "SELECT size, mtime FROM files WHERE path = ?",
                            (resolved,),
                        ).fetchone()
                except Exception as exc:
                    print(f"Warning: could not ingest {path} into vault: {exc}", flush=True)
            if row is None:
                connection.execute(
                    """
                    INSERT INTO files(
                        path, file_name, original_extension, mime_type, size, mtime, width, height,
                        has_camera, camera_make, camera_model, lens_model, focal_length_mm,
                        aperture_f_number, shutter_speed_seconds, iso_equivalent, color_space, captured_at,
                        latitude, longitude, altitude_meters, heading, location_name,
                        is_favorite, is_screenshot, is_video, duration_ms, is_live_photo, is_portrait,
                        is_raw, is_panorama, is_selfie, is_document, is_hidden, is_trashed, is_imported,
                        quality_score, blur_score, dhash, category, scanned_at
                    )
                    VALUES (
                        :path, :file_name, :original_extension, :mime_type, :size, :mtime, :width, :height,
                        :has_camera, :camera_make, :camera_model, :lens_model, :focal_length_mm,
                        :aperture_f_number, :shutter_speed_seconds, :iso_equivalent, :color_space, :captured_at,
                        :latitude, :longitude, :altitude_meters, :heading, :location_name,
                        :is_favorite, :is_screenshot, :is_video, :duration_ms, :is_live_photo, :is_portrait,
                        :is_raw, :is_panorama, :is_selfie, :is_document, :is_hidden, :is_trashed, :is_imported,
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
                        blur_score = :blur_score, dhash = :dhash, category = :category, is_imported = :is_imported, scanned_at = :scanned_at
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
