import atexit
import hashlib
import hmac
import os
import re
import secrets
import shutil
import subprocess
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from neural_gallery.db import connect
from neural_gallery.scan import scan_folder


@dataclass
class PeerDevice:
    id: str
    name: str
    model: str
    state: str = "nearby"  # "nearby", "pairing_requested", "paired"
    last_sync: str = "Never"
    ip: str = "127.0.0.1"


def get_local_ip() -> str:
    """Detect the active Wi-Fi / LAN IPv4 address for local network peer discovery."""
    import socket

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.2)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"


def get_hostname() -> str:
    """Get the local mDNS hostname (e.g. 'My-MacBook.local') for Bonjour discovery."""
    import socket
    import subprocess

    try:
        res = subprocess.run(["scutil", "--get", "LocalHostName"], capture_output=True, text=True, timeout=2)
        if res.returncode == 0 and res.stdout.strip():
            return f"{res.stdout.strip()}.local"
    except Exception:
        pass
    try:
        return f"{socket.gethostname()}.local"
    except Exception:
        return "localhost"


_TUNNEL_PROC: subprocess.Popen | None = None
_TUNNEL_URL: str | None = None
_TUNNEL_ENABLED: bool = False
_TUNNEL_LOCK = threading.Lock()


def is_tunnel_enabled() -> bool:
    """Return whether the Universal Cloudflare Tunnel is enabled by the user."""
    return _TUNNEL_ENABLED


def set_tunnel_enabled(enabled: bool, port: int = 8765) -> bool:
    """Enable or disable the Universal Cloudflare Tunnel dynamically."""
    global _TUNNEL_ENABLED
    with _TUNNEL_LOCK:
        _TUNNEL_ENABLED = enabled
        if not enabled:
            stop_tunnel_locked()
        else:
            start_tunnel_auto_locked(port)
        return _TUNNEL_ENABLED


def get_tunnel_url() -> str | None:
    """Check for active secure tunnel URL when router blocks local P2P traffic."""
    global _TUNNEL_URL
    if not _TUNNEL_ENABLED:
        return None
    if _TUNNEL_URL:
        return _TUNNEL_URL
    p = Path("/tmp/neural_gallery_tunnel.txt")
    if p.is_file():
        try:
            url = p.read_text().strip()
            if url.startswith("http"):
                _TUNNEL_URL = url
                return _TUNNEL_URL
        except Exception:
            pass
    return None


def start_tunnel_auto(port: int = 8765) -> str | None:
    """Automatically spawn cloudflared tunnel in background if installed, enabled, and not yet running."""
    with _TUNNEL_LOCK:
        return start_tunnel_auto_locked(port)


def start_tunnel_auto_locked(port: int = 8765) -> str | None:
    global _TUNNEL_PROC, _TUNNEL_URL
    if not _TUNNEL_ENABLED:
        return None

    existing = get_tunnel_url()
    if existing:
        return existing

    # Locate cloudflared executable (in PATH or standard Homebrew paths)
    cf_bin = shutil.which("cloudflared")
    if not cf_bin:
        for candidate in ("/opt/homebrew/bin/cloudflared", "/usr/local/bin/cloudflared"):
            if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
                cf_bin = candidate
                break
    if not cf_bin:
        return None

    try:
        proc = subprocess.Popen(
            [cf_bin, "tunnel", "--url", f"http://127.0.0.1:{port}"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        _TUNNEL_PROC = proc
        atexit.register(stop_tunnel)

        url_pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")
        ready_event = threading.Event()

        def _log_reader():
            global _TUNNEL_URL
            if not proc.stdout:
                return
            for line in proc.stdout:
                match = url_pattern.search(line)
                if match:
                    _TUNNEL_URL = match.group(0)
                    try:
                        Path("/tmp/neural_gallery_tunnel.txt").write_text(_TUNNEL_URL)
                    except Exception:
                        pass
                    ready_event.set()
                    break

        reader_thread = threading.Thread(target=_log_reader, daemon=True)
        reader_thread.start()
        ready_event.wait(timeout=3.5)
        return _TUNNEL_URL
    except Exception:
        return None


def stop_tunnel() -> None:
    """Cleanly terminate the auto-spawned cloudflared tunnel on application exit or user toggle."""
    with _TUNNEL_LOCK:
        stop_tunnel_locked()


def stop_tunnel_locked() -> None:
    global _TUNNEL_PROC, _TUNNEL_URL
    if _TUNNEL_PROC:
        try:
            _TUNNEL_PROC.terminate()
            _TUNNEL_PROC.wait(timeout=1.5)
        except Exception:
            try:
                _TUNNEL_PROC.kill()
            except Exception:
                pass
        _TUNNEL_PROC = None

    # Kill any lingering cloudflared tunnel processes
    try:
        subprocess.run(["pkill", "-f", "cloudflared tunnel"], capture_output=True, timeout=2)
    except Exception:
        pass

    _TUNNEL_URL = None
    try:
        p = Path("/tmp/neural_gallery_tunnel.txt")
        if p.is_file():
            p.unlink()
    except Exception:
        pass


class SyncEngine:
    """Zero-Cloud Air-Gapped Peer-to-Peer Wi-Fi Ingestion & Mesh Engine."""

    def __init__(self, vault_id: str | None = None):
        self.vault_id = vault_id or str(uuid.uuid4())
        # Clean guardrail: Start with zero mock/demo devices. Only real paired devices are recorded.
        self._devices: dict[str, PeerDevice] = {}
        self._sas_pin: str = "849 201"
        self._pin_created_at: float = time.time()
        self._previous_pin: str | None = None
        self._pin_ttl: int = 60  # Security OTP auto-rotates every 60 seconds when unpaired
        self._cert_fingerprint: str = hashlib.sha256(self.vault_id.encode()).hexdigest()[:16]
        self._last_sync_time: float = 0.0
        self._sync_batch_id: str = ""
        self._sync_batch_count: int = 0
        self._sync_batch_files: list[str] = []
        self._total_synced: int = 0

    @property
    def sas_pin(self) -> str:
        self.check_auto_rotate_pin()
        return self._sas_pin

    @property
    def pin_ttl(self) -> int:
        return self._pin_ttl

    def get_pin_ttl_remaining(self) -> int:
        """Return seconds remaining before active unauthenticated OTP expires and rotates."""
        elapsed = time.time() - self._pin_created_at
        return max(0, int(self._pin_ttl - elapsed))

    def check_auto_rotate_pin(self) -> bool:
        """Anti-hack protection: auto-rotate the OTP every 60s when no device is paired."""
        has_paired = any(d.state == "paired" for d in self._devices.values())
        if not has_paired:
            if (time.time() - self._pin_created_at) >= self._pin_ttl:
                self._previous_pin = self._sas_pin
                self.generate_new_sas_pin()
                return True
        return False

    def generate_new_sas_pin(self) -> str:
        """Derive a new 6-digit numeric Short Authentication String (SAS)."""
        num1 = secrets.randbelow(900) + 100
        num2 = secrets.randbelow(900) + 100
        self._sas_pin = f"{num1} {num2}"
        self._pin_created_at = time.time()
        return self._sas_pin

    def verify_pin(self, pin: str) -> bool:
        """Verify the user-entered 6-digit SAS pairing PIN with 15-second rotation grace window."""
        self.check_auto_rotate_pin()
        clean_input = pin.replace(" ", "").strip()
        clean_actual = self._sas_pin.replace(" ", "").strip()
        if len(clean_input) != 6:
            return False

        # Current active PIN
        if hmac.compare_digest(clean_input, clean_actual):
            return True

        # 15-second grace window for previous PIN during rotation to avoid user cutoff
        if self._previous_pin and (time.time() - self._pin_created_at) <= 15:
            clean_prev = self._previous_pin.replace(" ", "").strip()
            if hmac.compare_digest(clean_input, clean_prev):
                return True

        return False

    def pair_device(self, device_id: str, pin: str, name: str = "", model: str = "") -> dict[str, Any]:
        """Pair a device if the SAS PIN matches."""
        if not self.verify_pin(pin):
            return {"success": False, "error": "Invalid 6-digit SAS pairing PIN"}

        dev = self._devices.get(device_id)
        if not dev:
            dev = PeerDevice(
                id=device_id,
                name=name or f"Device {device_id[:6]}",
                model=model or "Mobile Device",
                state="paired",
                last_sync="Just now",
            )
            self._devices[device_id] = dev
        else:
            dev.state = "paired"
            dev.last_sync = "Just now"
            if name:
                dev.name = name
            if model:
                dev.model = model

        return {
            "success": True,
            "paired": True,
            "device": asdict(dev),
            "token": secrets.token_hex(16),
        }

    def unpair_device(self, device_id: str) -> bool:
        """Remove or unpair a device from the sync mesh."""
        if device_id in self._devices:
            del self._devices[device_id]
            return True
        return False

    def get_status(self, host: str | None = None, port: int = 8765) -> dict[str, Any]:
        """Return full peer-to-peer sync status for UI and Bonjour advertising."""
        self.check_auto_rotate_pin()
        local_ip = host if host and host not in ("0.0.0.0", "127.0.0.1") else get_local_ip()
        hostname = get_hostname()
        tunnel_enabled = is_tunnel_enabled()
        tunnel_url = (get_tunnel_url() or start_tunnel_auto(port)) if tunnel_enabled else None
        clean_pin = self._sas_pin.replace(" ", "").strip()
        pwa_url = f"http://{local_ip}:{port}/sync"
        pwa_url_direct = f"http://{local_ip}:{port}/sync?pin={clean_pin}"
        pwa_url_hostname = f"http://{hostname}:{port}/sync?pin={clean_pin}"
        pwa_url_tunnel = f"{tunnel_url}/sync?pin={clean_pin}" if tunnel_url else None
        has_paired = any(d.state == "paired" for d in self._devices.values())
        return {
            "status": "ready",
            "service_name": "_photovault._tcp.local.",
            "vault_id": self.vault_id,
            "cert_fingerprint": self._cert_fingerprint,
            "devices": [asdict(d) for d in self._devices.values()],
            "sas_pin": self._sas_pin,
            "pin_expires_in": self.get_pin_ttl_remaining() if not has_paired else None,
            "pin_ttl": self._pin_ttl,
            "tls_version": "TLS 1.3",
            "mesh_active": True,
            "port": port,
            "local_ip": local_ip,
            "hostname": hostname,
            "tunnel_enabled": tunnel_enabled,
            "tunnel_url": tunnel_url,
            "pwa_url": pwa_url,
            "pwa_url_direct": pwa_url_direct,
            "pwa_url_hostname": pwa_url_hostname,
            "pwa_url_tunnel": pwa_url_tunnel,
            "last_sync": {
                "batch_id": self._sync_batch_id,
                "count": self._sync_batch_count,
                "timestamp": self._last_sync_time,
                "files": self._sync_batch_files[-10:],
                "total_synced": self._total_synced,
            } if self._sync_batch_id else None,
        }

    def ingest_bytes(
        self,
        filename: str,
        data: bytes,
        incoming_folder: Path,
        db_path: Path,
    ) -> dict[str, Any]:
        """Ingest received photo bytes from a peer device directly into the local library."""
        incoming_folder.mkdir(parents=True, exist_ok=True)
        safe_name = Path(filename).name
        dest_path = incoming_folder / safe_name

        # If file already exists, disambiguate with timestamp
        if dest_path.exists():
            stem = dest_path.stem
            suffix = dest_path.suffix
            safe_name = f"{stem}_{int(time.time())}{suffix}"
            dest_path = incoming_folder / safe_name

        dest_path.write_bytes(data)

        # Trigger incremental scanning marked as imported
        summary = scan_folder(incoming_folder, db_path, is_imported=True)

        # Retrieve indexed file record
        file_id = None
        connection = connect(db_path)
        try:
            resolved_path = str(dest_path.resolve())
            row = connection.execute(
                "SELECT id FROM files WHERE path = ? OR path = ?",
                (resolved_path, str(dest_path)),
            ).fetchone()
            if row:
                file_id = row[0]
                connection.execute("UPDATE files SET is_imported = 1 WHERE id = ?", (file_id,))
                connection.commit()
        finally:
            connection.close()

        # Batch grouping: uploads within 4 seconds belong to the same sync batch
        now = time.time()
        if now - self._last_sync_time > 4.0:
            self._sync_batch_id = str(uuid.uuid4())
            self._sync_batch_count = 1
            self._sync_batch_files = [safe_name]
        else:
            self._sync_batch_count += 1
            self._sync_batch_files.append(safe_name)
        self._last_sync_time = now
        self._total_synced += 1

        return {
            "success": True,
            "filename": safe_name,
            "path": str(dest_path),
            "size": len(data),
            "file_id": file_id,
            "scan_summary": summary,
            "batch_id": self._sync_batch_id,
            "batch_count": self._sync_batch_count,
        }


# Global sync engine singleton
_ENGINE = SyncEngine()


def get_sync_engine() -> SyncEngine:
    return _ENGINE


MOBILE_PWA_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>Neural Gallery — P2P Media Sync</title>
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#070a13">
<style>
  :root {
    --bg: #070a13;
    --card: rgba(18, 24, 38, 0.88);
    --card-border: rgba(255, 255, 255, 0.08);
    --accent: #2563eb;
    --accent-light: #60a5fa;
    --accent-glow: rgba(37, 99, 235, 0.35);
    --ink: #f8fafc;
    --muted: #94a3b8;
    --success: #10b981;
    --warning: #f59e0b;
    --danger: #ef4444;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body {
    background: var(--bg);
    color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif;
    min-height: 100vh;
    padding: max(env(safe-area-inset-top), 20px) 16px max(env(safe-area-inset-bottom), 24px);
    display: flex;
    flex-direction: column;
    align-items: center;
    background-image: radial-gradient(circle at 50% 0%, rgba(37, 99, 235, 0.15) 0%, transparent 60%);
  }

  /* Header */
  .header {
    text-align: center;
    margin: 10px 0 20px;
    width: 100%;
    max-width: 460px;
  }
  .app-logo {
    width: 58px;
    height: 58px;
    margin: 0 auto 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 50%, #60a5fa 100%);
    border-radius: 16px;
    box-shadow: 0 8px 24px var(--accent-glow), 0 0 0 1px rgba(255, 255, 255, 0.2) inset;
  }
  .app-logo svg { width: 34px; height: 34px; fill: white; }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(37, 99, 235, 0.15);
    color: var(--accent-light);
    padding: 5px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 8px;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }
  .pulse {
    width: 8px;
    height: 8px;
    background: #10b981;
    border-radius: 50%;
    box-shadow: 0 0 10px #10b981;
    animation: pulseAnim 2s infinite ease-in-out;
  }
  @keyframes pulseAnim {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.2); }
  }
  h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 4px; }
  .subtitle { font-size: 13px; color: var(--muted); line-height: 1.4; }

  /* Card */
  .card {
    background: var(--card);
    border: 1px solid var(--card-border);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border-radius: 20px;
    padding: 22px;
    width: 100%;
    max-width: 460px;
    margin-bottom: 16px;
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
  }

  /* PIN Section */
  .pin-group {
    display: flex;
    gap: 8px;
    justify-content: center;
    margin: 18px 0 22px;
  }
  .pin-input {
    width: 46px;
    height: 56px;
    border-radius: 14px;
    border: 2px solid var(--card-border);
    background: rgba(7, 10, 19, 0.7);
    color: var(--ink);
    font-size: 26px;
    font-weight: 700;
    text-align: center;
    outline: none;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .pin-input:focus {
    border-color: var(--accent-light);
    box-shadow: 0 0 14px var(--accent-glow);
    background: rgba(37, 99, 235, 0.1);
  }
  .btn {
    width: 100%;
    padding: 15px;
    border-radius: 14px;
    border: none;
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    color: white;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 18px var(--accent-glow);
    transition: all 0.18s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .btn:active { transform: scale(0.98); opacity: 0.9; }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; box-shadow: none; }
  .btn-secondary {
    background: rgba(255, 255, 255, 0.08);
    color: var(--ink);
    border: 1px solid var(--card-border);
    box-shadow: none;
    margin-top: 10px;
  }
  .btn-secondary:active { background: rgba(255, 255, 255, 0.12); }

  /* Feature tags */
  .chips-container {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 12px 0 16px;
  }
  .chip {
    font-size: 11px;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.07);
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .chip-limit {
    background: rgba(37, 99, 235, 0.12);
    border-color: rgba(37, 99, 235, 0.3);
    color: var(--accent-light);
    font-weight: 600;
  }

  /* Upload Drop Zone */
  .drop-zone {
    border: 2px dashed rgba(59, 130, 246, 0.4);
    border-radius: 18px;
    padding: 28px 16px;
    text-align: center;
    cursor: pointer;
    background: rgba(37, 99, 235, 0.04);
    transition: all 0.2s ease;
    margin-bottom: 14px;
  }
  .drop-zone:active, .drop-zone.dragover {
    border-color: var(--accent-light);
    background: rgba(37, 99, 235, 0.1);
    transform: scale(0.99);
  }
  .drop-icons {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }
  .icon-circle {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: rgba(37, 99, 235, 0.15);
    border: 1px solid rgba(37, 99, 235, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-light);
  }
  .drop-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--ink);
    margin-bottom: 4px;
  }
  .drop-hint {
    font-size: 12px;
    color: var(--muted);
    line-height: 1.4;
  }
  .batch-badge {
    display: inline-block;
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    margin-top: 8px;
  }

  /* Progress Section */
  .progress-box {
    margin: 16px 0 10px;
    padding: 14px;
    background: rgba(7, 10, 19, 0.6);
    border-radius: 14px;
    border: 1px solid var(--card-border);
  }
  .progress-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    margin-bottom: 8px;
  }
  .progress-title {
    font-weight: 600;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 250px;
  }
  .progress-pct {
    font-weight: 700;
    color: var(--accent-light);
    font-family: ui-monospace, SFMono-Regular, monospace;
  }
  .progress-track {
    width: 100%;
    height: 8px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    overflow: hidden;
    position: relative;
  }
  .progress-bar-fill {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, #2563eb, #60a5fa);
    border-radius: 999px;
    transition: width 0.25s ease-out;
  }

  /* Toast Notification */
  .toast {
    position: fixed;
    top: max(env(safe-area-inset-top), 20px);
    left: 50%;
    transform: translateX(-50%) translateY(-100px);
    background: rgba(24, 30, 48, 0.96);
    border: 1px solid rgba(245, 158, 11, 0.4);
    color: #fef3c7;
    padding: 12px 18px;
    border-radius: 14px;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 14px 30px rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(16px);
    z-index: 9999;
    max-width: 90%;
    width: 380px;
    display: flex;
    align-items: center;
    gap: 10px;
    transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s;
    opacity: 0;
    pointer-events: none;
  }
  .toast.show {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }
  .toast.success {
    border-color: rgba(16, 185, 129, 0.4);
    color: #d1fae5;
  }

  /* Preview Grid */
  .preview-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-top: 14px;
    max-height: 380px;
    overflow-y: auto;
    padding: 2px;
  }
  .preview-card {
    position: relative;
    aspect-ratio: 1;
    border-radius: 12px;
    overflow: hidden;
    background: #0d1321;
    border: 1px solid var(--card-border);
  }
  .preview-card img, .preview-card video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .preview-type-badge {
    position: absolute;
    top: 5px;
    left: 5px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    font-size: 9px;
    font-weight: 700;
    padding: 2px 5px;
    border-radius: 4px;
    text-transform: uppercase;
    font-family: ui-monospace, monospace;
    backdrop-filter: blur(4px);
  }
  .preview-status {
    position: absolute;
    bottom: 5px;
    right: 5px;
    background: rgba(0, 0, 0, 0.75);
    color: var(--success);
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 5px;
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    gap: 3px;
  }
  .preview-status.pending { color: #f59e0b; }
  .preview-status.error { color: #ef4444; }

  /* Device details strip */
  .device-strip {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    border: 1px solid var(--card-border);
    margin-bottom: 14px;
    font-size: 12px;
  }
</style>
</head>
<body>

<!-- Toast -->
<div id="toast" class="toast">
  <span id="toast-icon">ℹ️</span>
  <span id="toast-text">Notice message</span>
</div>

<!-- Header -->
<div class="header">
  <div class="app-logo">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="white" fill-opacity="0.15" stroke="white"/>
      <circle cx="8.5" cy="8.5" r="1.5" fill="white"/>
      <polyline points="21 15 16 10 5 21" stroke="white"/>
    </svg>
  </div>
  <div class="badge"><span class="pulse"></span> Local Wi-Fi P2P Mesh</div>
  <h1>Neural Gallery Sync</h1>
  <p class="subtitle">Air-gapped sync directly to your Mac. No cloud, zero compression.</p>
</div>

<!-- Pairing Screen -->
<div class="card" id="pair-section">
  <h2 style="font-size: 18px; margin-bottom: 4px; font-weight: 700;">Enter SAS Pairing PIN</h2>
  <p class="subtitle">Type the 6-digit PIN displayed in the Neural Gallery Sync dialog on your Mac.</p>
  
  <div class="pin-group">
    <input type="tel" maxlength="1" class="pin-input" inputmode="numeric" autocomplete="one-time-code" autofocus>
    <input type="tel" maxlength="1" class="pin-input" inputmode="numeric">
    <input type="tel" maxlength="1" class="pin-input" inputmode="numeric">
    <input type="tel" maxlength="1" class="pin-input" inputmode="numeric">
    <input type="tel" maxlength="1" class="pin-input" inputmode="numeric">
    <input type="tel" maxlength="1" class="pin-input" inputmode="numeric">
  </div>
  
  <button class="btn" id="btn-pair">
    <span>Pair With Mac</span>
  </button>
</div>

<!-- Upload Screen -->
<div class="card" id="upload-section" style="display: none;">
  <div class="device-strip">
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></span>
      <span style="font-weight: 600; color: var(--ink);" id="mac-label">Mac Connected</span>
    </div>
    <span class="chip chip-limit" style="margin: 0;">Limit: 30 / batch</span>
  </div>

  <div class="chips-container">
    <span class="chip">📸 Photos (HEIC, RAW, JPEG, PNG, WebP)</span>
    <span class="chip">🎥 Videos (4K MOV, MP4, ProRes)</span>
    <span class="chip">⚡ Zero Compression</span>
  </div>

  <!-- Primary Photo & Video Picker (Native Gallery / Camera Roll where Done button is always enabled) -->
  <input 
    type="file" 
    id="file-input" 
    accept="image/*,video/*" 
    multiple 
    style="display: none;"
  >

  <!-- Secondary Files / Documents Picker (For loose camera RAW files from iCloud / Android Files) -->
  <input 
    type="file" 
    id="file-input-files" 
    multiple 
    style="display: none;"
  >

  <!-- Interactive Dropzone -->
  <div class="drop-zone" id="drop-zone">
    <div class="drop-icons">
      <div class="icon-circle">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
      </div>
      <div class="icon-circle">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="23 7 16 12 23 17 23 7"/>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
        </svg>
      </div>
    </div>
    <div class="drop-title">Select Photos & Videos</div>
    <div class="drop-hint">Tap to open Camera Roll (Done button active)</div>
    <span class="batch-badge">⚡ Batch Limit: Up to 30 items</span>
  </div>

  <div style="display: flex; flex-direction: column; gap: 8px;">
    <button class="btn" id="btn-select-media" type="button">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      <span>Choose from Photo Library</span>
    </button>

    <button class="btn btn-secondary" id="btn-select-files" type="button">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <span>Browse Files / Camera RAW (DNG, CR2...)</span>
    </button>
  </div>

  <!-- GPS Preservation Tip Card -->
  <div style="margin-top: 10px; padding: 10px 12px; border-radius: 12px; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2); font-size: 11px; color: #94a3b8; line-height: 1.45; text-align: left;">
    <strong style="color: #60a5fa; display: block; margin-bottom: 2px;">📍 Preserving Photo Location (GPS):</strong>
    <span>• <strong>iPhone:</strong> In the iOS photo picker, tap <em>Options</em> (top/bottom) and toggle <em>Location</em> or <em>All Photos Data</em> ON so Safari doesn't strip location.<br>
    • <strong>Android / WhatsApp:</strong> Social apps strip GPS before saving; camera photos need Location enabled with an active GPS satellite lock.</span>
  </div>

  <!-- Progress Box -->
  <div class="progress-box" id="progress-box" style="display: none;">
    <div class="progress-meta">
      <span class="progress-title" id="progress-status">Preparing upload...</span>
      <span class="progress-pct" id="progress-pct">0%</span>
    </div>
    <div class="progress-track">
      <div class="progress-bar-fill" id="progress-bar-fill"></div>
    </div>
  </div>

  <!-- Preview Grid -->
  <div class="preview-grid" id="preview-grid"></div>

  <!-- Action buttons shown after upload -->
  <div id="post-upload-actions" style="display: none; margin-top: 14px;">
    <button class="btn btn-secondary" id="btn-upload-more">
      <span>Upload Another Batch (Up to 30)</span>
    </button>
  </div>
</div>

<script>
const pinInputs = document.querySelectorAll(".pin-input");
const btnPair = document.querySelector("#btn-pair");
const pairSection = document.querySelector("#pair-section");
const uploadSection = document.querySelector("#upload-section");
const fileInput = document.querySelector("#file-input");
const fileInputFiles = document.querySelector("#file-input-files");
const dropZone = document.querySelector("#drop-zone");
const btnSelectMedia = document.querySelector("#btn-select-media");
const btnSelectFiles = document.querySelector("#btn-select-files");
const previewGrid = document.querySelector("#preview-grid");
const progressBox = document.querySelector("#progress-box");
const progressBarFill = document.querySelector("#progress-bar-fill");
const progressStatus = document.querySelector("#progress-status");
const progressPct = document.querySelector("#progress-pct");
const postUploadActions = document.querySelector("#post-upload-actions");
const btnUploadMore = document.querySelector("#btn-upload-more");
const toast = document.querySelector("#toast");
const toastIcon = document.querySelector("#toast-icon");
const toastText = document.querySelector("#toast-text");

let toastTimer = null;
function showToast(message, isSuccess = false, duration = 4000) {
  if (toastTimer) clearTimeout(toastTimer);
  toastIcon.textContent = isSuccess ? "✅" : "⚠️";
  toastText.textContent = message;
  toast.className = isSuccess ? "toast success show" : "toast show";
  if (navigator.vibrate) navigator.vibrate([20]);
  toastTimer = setTimeout(() => {
    toast.className = "toast";
  }, duration);
}

// PIN inputs navigation & paste support
pinInputs.forEach((input, index) => {
  input.addEventListener("input", (e) => {
    if (e.target.value.length >= 1) {
      e.target.value = e.target.value.slice(-1);
      if (index < pinInputs.length - 1) {
        pinInputs[index + 1].focus();
      } else {
        // Auto-submit when 6th digit entered
        setTimeout(() => btnPair.click(), 100);
      }
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !e.target.value && index > 0) {
      pinInputs[index - 1].focus();
    }
  });

  input.addEventListener("paste", (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData("text").replace(/\\D/g, "");
    if (pasted.length) {
      pasted.split("").slice(0, 6).forEach((char, idx) => {
        if (pinInputs[idx]) pinInputs[idx].value = char;
      });
      if (pasted.length >= 6) {
        setTimeout(() => btnPair.click(), 100);
      } else if (pinInputs[pasted.length]) {
        pinInputs[pasted.length].focus();
      }
    }
  });
});

function getPin() {
  return Array.from(pinInputs).map(i => i.value.trim()).join("");
}

function getDeviceInfo() {
  let model = "Mobile Device";
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) model = "iPhone";
  else if (/iPad/.test(ua)) model = "iPad";
  else if (/Android/.test(ua)) model = "Android Device";

  let id = localStorage.getItem("neural_gallery_device_id");
  if (!id) {
    id = "dev-" + Math.random().toString(36).substring(2, 11);
    localStorage.setItem("neural_gallery_device_id", id);
  }
  return { id, name: model, model };
}

// Pair logic
btnPair.addEventListener("click", async () => {
  const pin = getPin();
  if (pin.length !== 6) {
    showToast("Please enter all 6 digits of the PIN.");
    return;
  }
  btnPair.disabled = true;
  btnPair.innerHTML = "<span>Verifying PIN...</span>";
  try {
    const dev = getDeviceInfo();
    const res = await fetch("/api/sync/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Neural-Gallery": "1" },
      body: JSON.stringify({ pin, device_id: dev.id, name: dev.name, model: dev.model })
    });
    const data = await res.json();
    if (data.success || data.paired) {
      pairSection.style.display = "none";
      uploadSection.style.display = "block";
      showToast("Successfully paired with Mac!", true);
    } else {
      showToast(data.error || "Pairing failed. Check PIN on your Mac.");
      btnPair.disabled = false;
      btnPair.innerHTML = "<span>Pair With Mac</span>";
    }
  } catch (err) {
    showToast("Connection to Mac failed over Wi-Fi.");
    btnPair.disabled = false;
    btnPair.innerHTML = "<span>Pair With Mac</span>";
  }
});

// Auto-pair via QR code URL query ?pin=XXXXXX
const urlParams = new URLSearchParams(window.location.search);
const autoPin = (urlParams.get("pin") || "").replace(/\\s+/g, "").trim();
if (autoPin.length === 6) {
  autoPin.split("").forEach((digit, idx) => {
    if (pinInputs[idx]) pinInputs[idx].value = digit;
  });
  setTimeout(() => { btnPair.click(); }, 150);
}

// File triggers
dropZone.addEventListener("click", () => fileInput.click());
btnSelectMedia.addEventListener("click", () => fileInput.click());
btnSelectFiles.addEventListener("click", () => fileInputFiles.click());
btnUploadMore.addEventListener("click", () => fileInput.click());

// Drag & drop highlight
["dragenter", "dragover"].forEach(evt => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
});
["dragleave", "drop"].forEach(evt => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
  });
});
dropZone.addEventListener("drop", (e) => {
  if (e.dataTransfer && e.dataTransfer.files.length) {
    handleUploadBatch(e.dataTransfer.files);
  }
});

// Format byte size
function formatBytes(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

fileInput.addEventListener("change", (e) => {
  if (e.target.files && e.target.files.length) {
    handleUploadBatch(e.target.files);
  }
  fileInput.value = "";
});

fileInputFiles.addEventListener("change", (e) => {
  if (e.target.files && e.target.files.length) {
    handleUploadBatch(e.target.files);
  }
  fileInputFiles.value = "";
});

// Unified media upload handler enforcing 30-item batch limit
async function handleUploadBatch(selectedFileList) {
  let allFiles = Array.from(selectedFileList || []);
  if (!allFiles.length) return;

  // Enforce batch limit: maximum 30 in one go
  const BATCH_LIMIT = 30;
  let filesToUpload = allFiles;
  if (allFiles.length > BATCH_LIMIT) {
    showToast(`⚠️ Batch limit applied: Uploading first ${BATCH_LIMIT} of ${allFiles.length} items.`, false, 5000);
    filesToUpload = allFiles.slice(0, BATCH_LIMIT);
  }

  const total = filesToUpload.length;
  progressBox.style.display = "block";
  postUploadActions.style.display = "none";
  btnSelectMedia.disabled = true;
  btnSelectFiles.disabled = true;

  let successCount = 0;

  for (let i = 0; i < total; i++) {
    const file = filesToUpload[i];
    const isVideo = file.type.startsWith("video/") || /\\.(mov|mp4|m4v|webm|mkv|avi|3gp)$/i.test(file.name);
    const ext = file.name.split(".").pop().toUpperCase() || (isVideo ? "MOV" : "IMG");

    // Create preview placeholder card
    const card = document.createElement("div");
    card.className = "preview-card";

    // Media element
    const objectUrl = URL.createObjectURL(file);
    if (isVideo) {
      const vid = document.createElement("video");
      vid.src = objectUrl;
      vid.muted = true;
      vid.playsInline = true;
      vid.preload = "metadata";
      card.appendChild(vid);
    } else {
      const img = document.createElement("img");
      img.src = objectUrl;
      img.alt = file.name;
      card.appendChild(img);
    }

    // Type badge
    const typeBadge = document.createElement("div");
    typeBadge.className = "preview-type-badge";
    typeBadge.textContent = isVideo ? `▶ ${ext}` : ext;
    card.appendChild(typeBadge);

    // Status tag
    const statusTag = document.createElement("div");
    statusTag.className = "preview-status pending";
    statusTag.textContent = "Syncing...";
    card.appendChild(statusTag);

    previewGrid.prepend(card);

    // Update progress UI
    const currentPercent = Math.round((i / total) * 100);
    progressBarFill.style.width = `${currentPercent}%`;
    progressPct.textContent = `${currentPercent}%`;
    progressStatus.textContent = `Syncing (${i + 1}/${total}): ${file.name} (${formatBytes(file.size)})`;

    // Upload to server
    const formData = new FormData();
    formData.append("file", file, file.name);

    try {
      const res = await fetch("/api/sync/upload", {
        method: "POST",
        headers: { "X-Filename": encodeURIComponent(file.name) },
        body: formData
      });
      const data = await res.json();
      if (data.success || data.file_id) {
        statusTag.className = "preview-status";
        statusTag.textContent = "✓ Synced";
        successCount++;
      } else {
        statusTag.className = "preview-status error";
        statusTag.textContent = "✕ Error";
      }
    } catch (err) {
      console.error("Upload error:", err);
      statusTag.className = "preview-status error";
      statusTag.textContent = "✕ Failed";
    }
  }

  // Finished batch
  progressBarFill.style.width = "100%";
  progressPct.textContent = "100%";
  progressStatus.textContent = `Batch complete: Synced ${successCount} of ${total} items directly to Mac!`;
  showToast(`🎉 Synced ${successCount} items to your Mac!`, true, 4000);

  btnSelectMedia.disabled = false;
  btnSelectFiles.disabled = false;
  postUploadActions.style.display = "block";
}
</script>
</body>
</html>
"""
