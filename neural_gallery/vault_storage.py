"""Managed Vault Storage System (Apple Photos style container with SSD support).

Stores ingested photos safely inside an encapsulated package (e.g. NeuralGallery.photosvault)
with restricted filesystem permissions (chmod 0700) so no unauthorized users or external
processes can view or tamper with photos. Supports moving vault storage to an external SSD.
"""

import json
import os
import shutil
import time
from pathlib import Path
from typing import Any

DEFAULT_VAULT_NAME = "NeuralGallery.photosvault"
CONFIG_FILE_NAME = "vault_config.json"


def _config_dir() -> Path:
    from neural_gallery.db import default_db
    return default_db().parent


def _config_path() -> Path:
    return _config_dir() / CONFIG_FILE_NAME


def get_default_vault_path() -> Path:
    return Path.home() / "Pictures" / DEFAULT_VAULT_NAME


def get_vault_config() -> dict[str, Any]:
    """Retrieve active vault storage configuration."""
    cfg_file = _config_path()
    default_path = str(get_default_vault_path())
    config = {
        "vault_path": default_path,
        "managed_ingest": True,  # Ingest and encapsulate files by default (Apple Photos style)
    }

    if cfg_file.exists():
        try:
            saved = json.loads(cfg_file.read_text(encoding="utf-8"))
            if isinstance(saved, dict):
                config.update(saved)
        except Exception:
            pass

    return config


def save_vault_config(config: dict[str, Any]) -> None:
    cfg_file = _config_path()
    cfg_file.parent.mkdir(parents=True, exist_ok=True)
    cfg_file.write_text(json.dumps(config, indent=2), encoding="utf-8")


def ensure_vault_structure(vault_path: Path) -> dict[str, Path]:
    """Ensure vault package directory exists with strict chmod 0700 permissions."""
    vault_path = Path(vault_path).expanduser().resolve()
    vault_path.mkdir(parents=True, exist_ok=True)

    # Restrict permissions so other users cannot access
    try:
        os.chmod(vault_path, 0o700)
    except Exception:
        pass

    originals = vault_path / "originals"
    originals.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(originals, 0o700)
    except Exception:
        pass

    thumbnails = vault_path / "thumbnails"
    thumbnails.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(thumbnails, 0o700)
    except Exception:
        pass

    return {
        "root": vault_path,
        "originals": originals,
        "thumbnails": thumbnails,
    }


def get_vault_info() -> dict[str, Any]:
    """Return vault storage status, SSD/Drive stats, and free disk space."""
    cfg = get_vault_config()
    vault_path = Path(cfg["vault_path"]).expanduser().resolve()
    dirs = ensure_vault_structure(vault_path)

    # Calculate free space
    free_bytes = 0
    total_bytes = 0
    try:
        usage = shutil.disk_usage(vault_path)
        free_bytes = usage.free
        total_bytes = usage.total
    except Exception:
        pass

    is_external = str(vault_path).startswith("/Volumes/")

    # Count files & calculate total vault size
    file_count = 0
    total_size = 0
    try:
        for p in dirs["originals"].rglob("*"):
            if p.is_file():
                file_count += 1
                total_size += p.stat().st_size
    except Exception:
        pass

    return {
        "vault_path": str(vault_path),
        "managed_ingest": bool(cfg.get("managed_ingest", True)),
        "is_external": is_external,
        "is_ssd": is_external or "SSD" in str(vault_path).upper(),
        "free_bytes": free_bytes,
        "total_bytes": total_bytes,
        "free_formatted": f"{free_bytes / (1024**3):.1f} GB",
        "total_formatted": f"{total_bytes / (1024**3):.1f} GB",
        "file_count": file_count,
        "total_size_bytes": total_size,
        "total_size_formatted": f"{total_size / (1024**2):.1f} MB" if total_size < 1024**3 else f"{total_size / (1024**3):.2f} GB",
    }


def set_vault_location(new_path: str, managed_ingest: bool = True) -> dict[str, Any]:
    """Update vault location (e.g. to an external SSD)."""
    p = Path(new_path).expanduser().resolve()
    if p.is_file():
        raise ValueError("Vault location must be a directory path")

    ensure_vault_structure(p)
    config = {
        "vault_path": str(p),
        "managed_ingest": managed_ingest,
    }
    save_vault_config(config)
    return get_vault_info()


def ingest_file_into_vault(
    source_path: Path,
    captured_at: float | None = None,
    vault_dir: Path | None = None,
) -> Path:
    """Copy a photo into the secure vault storage structure (originals/YYYY/MM/).

    Returns the new destination Path inside the vault.
    """
    if vault_dir is None:
        cfg = get_vault_config()
        vault_dir = Path(cfg["vault_path"]).expanduser().resolve()

    dirs = ensure_vault_structure(vault_dir)
    originals = dirs["originals"]

    # If source is already inside the vault originals, no need to copy
    try:
        source_resolved = source_path.resolve()
        if source_resolved.is_relative_to(originals.resolve()):
            return source_resolved
    except (ValueError, AttributeError):
        pass

    # Determine year/month subfolder
    if captured_at and captured_at > 0:
        year_str = time.strftime("%Y", time.localtime(captured_at))
        month_str = time.strftime("%m", time.localtime(captured_at))
    else:
        year_str = time.strftime("%Y", time.localtime())
        month_str = time.strftime("%m", time.localtime())

    subfolder = originals / year_str / month_str
    subfolder.mkdir(parents=True, exist_ok=True)

    dest_filename = source_path.name
    dest_path = subfolder / dest_filename

    # Disambiguate if target already exists with different size
    if dest_path.exists():
        if dest_path.stat().st_size == source_path.stat().st_size:
            return dest_path.resolve()
        stem = source_path.stem
        ext = source_path.suffix
        dest_filename = f"{stem}_{int(time.time() * 1000) % 1000000}{ext}"
        dest_path = subfolder / dest_filename

    shutil.copy2(source_path, dest_path)

    # Secure permissions
    try:
        os.chmod(dest_path, 0o600)
    except Exception:
        pass

    return dest_path.resolve()
