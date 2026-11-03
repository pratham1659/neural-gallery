# Aperture Vault — Product Requirements Document (PRD)

**Document Version:** 1.0.0-PROD  
**Author:** Principal Systems Architect & Lead Desktop Security Engineer  
**Target Platform:** macOS Sonoma 14+ / macOS Sequoia 15+ (Apple Silicon: M1/M2/M3/M4 Native)  
**Security Classification:** Strict Zero-Knowledge / Defense-in-Depth  

---

## 1. Executive Summary & Problem Statement

### 1.1 The Privacy Paradox in Digital Media Management
Modern personal photography and media archiving sit at an untenable crossroads:

1. **The Cloud Surveillance Compromise (Google Photos, Apple iCloud, Microsoft OneDrive):**  
   Commercial cloud media lockers provide rich usability—fluid chronological timelines, face recognition, semantic natural language search ("receipts from Tokyo", "sunset over beach"), and seamless multi-device synchronization. However, this convenience demands the surrender of absolute privacy: photos are scanned server-side, subject to corporate AI model training, subpoena compliance, automated content-moderation false positives, and catastrophic cloud credential/infrastructure breaches.
2. **The Local Storage Usability Void (Cryptomator, VeraCrypt, Encrypted APFS DMGs):**  
   Existing zero-knowledge desktop storage solutions treat encrypted data as opaque binary blocks. Users are forced to interact with unindexed directory trees, lacking thumbnail generation, interactive timeline scrubbing, face clustering, OCR text discovery, or localized reverse geocoding. Decrypting a folder exposes thumbnails and caches to OS temporary folders (`/private/var/folders/`, swap files, QuickLook caches), compromising the zero-knowledge boundary.

### 1.2 Aperture Vault Product Vision
**Aperture Vault** eliminates this trade-off by engineering an encrypted, password-protected, zero-knowledge desktop vault engineered natively for Apple Silicon (macOS). It couples:
- **Cloud-Grade Discovery:** A fluid Google Photos-style multi-tiered timeline (Years/Months/Days), offline face clustering, localized reverse geocoding, and zero-cloud semantic search powered directly by the Apple Neural Engine (ANE).
- **Finder-Grade Systems Control:** A high-throughput dual-mode multi-column file manager with deep EXIF/IPTC inspection, batch metadata sanitization, and cryptographic file checksum verification.
- **Air-Gapped Ingestion:** Local-network peer-to-peer ingestion over mDNS/TLS 1.3 from iOS (Share Sheet / local P2P) and Android (mDNS TLS stream / local pairing PWA), bypassing all third-party cloud relays.
- **Strict Zero-Knowledge Guarantee:** The operating system, disk controller, and external observers see only authenticated encrypted payloads (`.aperture` container blocks and SQLCipher databases). Temporary RAM buffers are locked (`mlock`) and cryptographically zeroized on drop.

---

## 2. Target User Personas & Core Use Cases

### 2.1 Personas

```
+----------------------------------------------------------------------------------------------------+
| PERSONA 1: Investigative Journalist / Human Rights Advocate ("The Sentinel")                      |
| - Threat Model: Target of targeted legal discovery, border searches, device seizure, spyware.   |
| - Key Need: Absolute data zeroization on lock (`Cmd+L`), zero temporary disk leakage,            |
|   instant metadata stripping, verifiable air-gapped operation.                                     |
+----------------------------------------------------------------------------------------------------+
| PERSONA 2: Privacy-Conscious Apple Silicon Power User ("The Archivist")                           |
| - Library Scale: 50,000 to 250,000 RAW, HEIC, ProRAW, and 4K ProRes assets.                       |
| - Key Need: 120fps ProMotion virtualized scrolling, offline natural language search, local face    |
|   grouping without sending a single vector to Google or Apple servers.                             |
+----------------------------------------------------------------------------------------------------+
| PERSONA 3: Self-Sovereign Multi-Device Family Coordinator ("The Custodian")                        |
| - Fleet: Mixed environment (macOS desktop, iPhone personal device, partner's Android phone).      |
| - Key Need: Effortless local Wi-Fi sync without subscribing to Google One or iCloud Family,       |
|   retaining full control over encrypted cold storage backups on local NVMe drives.                |
+----------------------------------------------------------------------------------------------------+
```

### 2.2 Core Use Cases

1. **Biometric Vault Unlock & Instant Timeline Hydration:**  
   User launches the application. The vault remains an encrypted blob until Touch ID or the Master Password unlocks the Master Key via macOS Keychain / Secure Enclave. The app transitions from locked state to a 60–120 fps timeline view in under 1.2 seconds.
2. **Offline Semantic Discovery ("Zero-Cloud Natural Language Search"):**  
   User enters natural language queries such as *"handwritten whiteboards from sprint planning"* or *"golden retriever playing in snow"*. The query is embedded locally via a quantized MobileCLIP model running on the Apple Neural Engine (ANE) and matched against local 768-dimensional vectors in `< 35ms` over 100,000 assets.
3. **Dual-Mode File Inspector & Batch Metadata Sanitizer:**  
   User switches to File Manager Mode (`Cmd+2`), inspects raw EXIF tags (shutter speed, focal length, lens serials, exact GPS coordinates), scrubs sensitive geolocations before export, and verifies SHA-256 / BLAKE3 cryptographic hashes.
4. **Air-Gapped Cross-Platform Sync:**  
   User connects iPhone or Android device to the home Wi-Fi network. The mobile client discovers the desktop vault via Bonjour/mDNS (`_photovault._tcp.local.`), negotiates an ephemeral TLS 1.3 socket via a 6-digit mutual SAS (Short Authentication String) PIN, and streams original-quality HEIC/RAW files directly into memory-backed encrypted storage.
5. **Panic Lockdown & Memory Zeroization:**  
   On user shortcut (`Cmd+L`), system sleep, screensaver activation, or tamper signal, the application immediately clears decrypted database keys, flushes memory pages with `sodium_memzero` / Rust `zeroize`, unbinds network sockets, and drops back to the master login barrier within `< 10ms`.

---

## 3. Functional Requirements

### FR-1: Cryptographic Vault Architecture & Key Lifecycle
- **FR-1.1 Master Key Derivation:** Support master passphrase derivation using **Argon2id** (memory cost: 64 MiB, time cost: 3 iterations, parallelism: 4 lanes) yielding a 256-bit Key Encryption Key (KEK).
- **FR-1.2 Hardware Keystore Binding:** Support macOS Keychain integration via `LocalAuthentication.framework` (Touch ID / Secure Enclave) protecting an enclave-wrapped KEK.
- **FR-1.3 Envelope Encryption:** Every media asset is encrypted using a unique random 256-bit Asset Key with **AES-256-GCM** (or **XChaCha20-Poly1305** for stream chunks) utilizing non-repeating cryptographically secure 96-bit (or 192-bit) Initialization Vectors (IVs) and 128-bit authentication tags.
- **FR-1.4 Zero Unencrypted Disk Artifacts:** Decryption must occur on-the-fly in virtual memory. No unencrypted thumbnails, SQLite pages, or decoded frame buffers shall ever touch persistent storage or standard swap space.

### FR-2: Vault Locking & Memory Zeroization
- **FR-2.1 Auto-Lock Triggers:** The vault shall enter the Locked State immediately upon:
  - User-initiated shortcut: `Cmd + L`.
  - Configurable idle inactivity timeout (default: 5 minutes).
  - macOS system events: Display sleep, screensaver activation, workstation lock (`NSWorkspaceScreensDidSleepNotification`, `com.apple.screenIsLocked`).
  - Signal interrupts: `SIGTERM`, `SIGINT`, or application backgrounding.
- **FR-2.2 Memory Scrubbing:** On lock, all sensitive memory (KEK, Master Database Key, Asset Keys, uncompressed image buffers, decrypted SQLite cache pages) must be scrubbed using volatile memory overwrites (`zeroize::Zeroize` / `memset_s`) and unpinned via `munlock`.

### FR-3: Dual-Mode Presentation System
- **FR-3.1 Gallery Timeline Mode (`Cmd + 1`):**
  - High-performance virtualized canvas/grid with dynamic temporal aggregation:
    - **Years View:** Curated hero highlights per calendar year.
    - **Months View:** Chronological monthly sections with location headers.
    - **Days View:** Granular high-density photo grid with continuous vertical scrolling.
  - Multi-touch pinch-to-zoom gestures switching smoothly across Years, Months, and Days.
  - Localized reverse-geocoded headers (e.g., *"Kyoto, Japan • October 2024"*) resolved via an offline municipal SQLite/H3 boundary database.
  - People & Pets carousel displaying clustered facial crops with user-editable name bindings.
- **FR-3.2 File Manager Mode (`Cmd + 2`):**
  - Multi-column Finder-style hierarchical view (Columns: Filename, File Size, Format, Date Modified, Dimensions, ISO, Camera Model).
  - Collapsible Inspector Sidebar (`Cmd + I`) detailing complete EXIF, IPTC, and TIFF metadata dictionaries.
  - Cryptographic integrity badges: BLAKE3/SHA-256 hash calculation, encrypted container offset verification.
  - Batch operations: Mass tag insertion, EXIF GPS stripping, bulk export with re-encryption or plain export.

### FR-4: Apple Silicon Native Vision & Offline AI Pipeline
- **FR-4.1 Face Detection & Alignment:** Utilize Apple Vision framework (`VNDetectFaceRectanglesRequest` and `VNDetectFaceLandmarksRequest`) to extract bounding boxes and landmarks directly on the Apple Neural Engine (ANE).
- **FR-4.2 Face Embeddings & Clustering:** Generate 512-dimensional normalized face embeddings and cluster individuals via local incremental DBSCAN / Hierarchical Agglomerative Clustering (HAC) without external cloud calls.
- **FR-4.3 Optical Character Recognition (OCR):** Extract text from images using `VNRecognizeTextRequest` (fast/accurate modes), feeding tokenized extracted strings into an encrypted SQLite FTS5 full-text index.
- **FR-4.4 Semantic Natural Language Search:**
  - Execute multimodal text-to-image semantic indexing using an ANE-optimized quantized **MobileCLIP** (ViT-B/16 or MobileCLIP-B) Core ML model.
  - Perform sub-50ms vector similarity searches using `sqlite-vec` / cosine similarity over 768-dimensional normalized floating-point vectors.

### FR-5: Local Peer-to-Peer Wi-Fi Ingestion Engine
- **FR-5.1 Discovery:** Broadcast service discovery beacon via Bonjour / mDNS on `_photovault._tcp.local.` on the local Wi-Fi interface only (RFC 6762 / RFC 6763).
- **FR-5.2 Secure Channel Negotiation:** Ephemeral TLS 1.3 socket server binding dynamically to an unassigned port. Authentication enforced via a 6-digit cryptographic Short Authentication String (SAS) or pairing PIN presented on the macOS screen.
- **FR-5.3 Client Ingestion Streams:**
  - **iOS Ingestion:** Native iOS Share Sheet app / lightweight client syncing directly over the TLS 1.3 stream.
  - **Android Ingestion:** Local Wi-Fi browser-based PWA fallback or dedicated Android client connecting to the TLS 1.3 endpoint, supporting resumable chunked file transfers.
- **FR-5.4 In-Memory Decryption Pipeline:** Ingested network chunks flow directly from TLS socket into memory buffers, generate thumbnail and embeddings in RAM, encrypt via AES-256-GCM, and commit directly to the encrypted container.

---

## 4. Non-Functional Requirements (NFRs)

| ID | Category | Requirement Specification | Measurement Metric |
| :--- | :--- | :--- | :--- |
| **NFR-1** | **Cold Launch Latency** | Cold start of application to fully rendered, unlocked timeline grid | **< 1,200 ms** on Apple Silicon M1 (baseline) |
| **NFR-2** | **Scroll Performance** | Virtualized list/grid rendering with 50,000+ indexed media assets | **Steady 60–120 fps** (ProMotion adaptive refresh) |
| **NFR-3** | **Search Latency** | Natural language semantic vector query across 50,000+ items | **< 35 ms** response time (ANE inference + vector scan) |
| **NFR-4** | **Disk Security** | Raw disk write policy for plain data, caches, and temp files | **0 bytes** of unencrypted data written to disk |
| **NFR-5** | **Memory Footprint** | Inactive unlocked state memory allocation | **< 180 MiB** working set RAM |
| **NFR-6** | **Zeroization Latency**| Complete memory wipe and key purge upon `Cmd+L` or system lock | **< 10 ms** execution time |
| **NFR-7** | **Network Boundary** | Network egress / external telemetry | **0 outgoing external requests**; firewall verified air-gapped |
| **NFR-8** | **Data Integrity** | ACID compliance and write resilience against unexpected power cut | Atomic commit via SQLCipher WAL mode & chunk checksums |

---

## 5. Success Metrics, Constraints & Guardrails

### 5.1 Success Metrics (KPIs)
- **Zero Cloud Leakage Score:** 100% of network packets inspected via Wireshark/Little Snitch during 48 hours of continuous operation show zero egress outside the local subnet (`192.168.x.x` / `10.x.x.x` / `fe80::/10`).
- **Cryptographic Zeroization Verification:** 100% success rate in memory forensic dumps (lldb core dumps post-lock) proving zero leakage of Master KEK, SQLCipher salt, or plain asset bytes.
- **UI Responsiveness:** 0% dropped frames during inertial scrolling on 120Hz ProMotion displays with a test dataset of 100,000 items.

### 5.2 Architectural Constraints
- **Hardware Target:** Exclusive optimization for Apple Silicon ARM64 architecture (macOS 14.0 Sonoma and macOS 15.0 Sequoia). Intel x86_64 is explicitly deprecated to leverage unified memory architecture and direct ANE Core ML bridges.
- **Sandboxing & Privileges:** Operates inside an App Sandbox with hardened runtime, requesting only network incoming/outgoing local socket entitlements and biometric authentication (`com.apple.security.device.camera` and internet client entitlements explicitly excluded).

### 5.3 Anti-Patterns Prohibited
- ❌ **No Temporary Disk Swaps:** Never write decrypted images to `/tmp`, `NSTemporaryDirectory()`, or webview asset protocols (`tauri://localhost` pointing to unencrypted disk paths).
- ❌ **No Cloud Microservices:** Zero reliance on external reverse geocoding APIs (e.g., Google Maps / Mapbox), cloud OCR, or third-party analytical telemetry.
- ❌ **No Node.js Backend Runtimes:** No Electron or node backend dependencies in the production release; the core runtime must be Rust native with Swift bridges to guarantee deterministic memory layouts and zeroization primitives.
