# Neural Gallery Architecture Guardrails

This document defines mandatory architectural, data, and security invariants for Neural Gallery. All future agentic and human contributions must strictly adhere to these guardrails.

---

## 1. Zero Demo / Mock Data Guardrail

> **Mandatory Rule:** All counts, labels, badges, device listings, and metadata in the catalog, sidebar, and gallery views must be derived from **real-time database queries and live state**. Hardcoded demo numbers, mock items, or fake placeholder statistics are strictly prohibited.

### Requirements:
1. **Sidebar & Catalog Counts**:
   - Every number displayed in `Sidebar.tsx`, `Header.tsx`, or any catalog view must originate from the reactive `LibraryStats` object returned by `/api/stats`, `/api/folders`, `/api/people`, or `/api/sync/status`.
   - Categories with zero items must display `0` (or contextual ground truth like `0 trips` or `Off`), never hardcoded mock numbers.
   - New media subcategories (e.g., ProRes, Slo-mo, Time-lapse, Screen Recordings, Panoramas, Documents, Shared Albums, Imports) must be queried directly from SQLite via `_stats()` in `neural_gallery/review.py`.
2. **Wi-Fi Sync & Peer Devices**:
   - Do not display static mock or sample devices (e.g. hardcoded iPhone/Pixel devices). Only real peers detected on the local network or paired through SAS PIN handshakes may appear.
3. **Map & Geocoding**:
   - Only photos with valid GPS coordinates in SQLite (`latitude IS NOT NULL AND longitude IS NOT NULL`) may appear as pins or clusters on the map view.

---

## 2. Vault Security & Biometric Access Guardrail

> **Mandatory Rule:** When the vault is locked (`isLocked === true`), the entire gallery must be inaccessible. Access requires authentication via native macOS Touch ID or the master passcode. No bypass, empty submission, or unverified unlocking is permitted.

### Requirements:
1. **Persistent Session Lock**:
   - Lock state is synchronized with `sessionStorage.getItem("neural_vault_locked")`. Page reloads while locked must remain locked until properly authenticated.
2. **Mac Touch ID Platform Authenticator**:
   - Utilizes WebAuthn platform authenticators (`PublicKeyCredential` with `authenticatorAttachment: "platform"` and `userVerification: "required"`).
   - Prompts the native macOS biometric sensor (Touch ID) or macOS system password.
   - If canceled or failed (`NotAllowedError`), access is denied and the vault remains locked.
3. **Master Passcode Verification**:
   - Stored in `localStorage.getItem("neural_vault_passcode")` (default: `1234`).
   - Verification must compare the exact trimmed input against the stored passcode.
   - Incorrect passcode attempts trigger shake animations, error alerts, and block access.
4. **Visual & Interaction Shielding**:
   - Full blackout and blur curtain (`z-[9999]`, `backdrop-blur-3xl`, `opacity-0` for underlying elements) prevents viewing photos, thumbnails, or metadata while locked.
   - Escape key and background hotkeys are captured and ignored while locked.

---

## 3. Photo Orientation & EXIF Transposition Guardrail

> **Mandatory Rule:** Photo dimensions and thumbnail rendering must respect EXIF orientation flags (`ImageOps.exif_transpose`).

### Requirements:
1. When generating thumbnails or inspecting photos (in `neural_gallery/review.py` and `neural_gallery/scan.py`), always apply `ImageOps.exif_transpose(image)`.
2. Aspect ratio calculations must reflect true post-rotation dimensions (`is_portrait = 1` if transposed height > width).
3. Photos taken in portrait orientation (such as `8096.jpg`) must display in portrait mode with correct aspect ratio across all gallery layouts.

---

*Last Updated: 2026-11-04*
