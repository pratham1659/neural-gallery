# Aperture Vault — Technical Requirements Document (TRD)

**Document Version:** 1.0.0-PROD  
**Author:** Principal Systems Architect & Lead Desktop Security Engineer  
**Target Architecture:** Apple Silicon (macOS Sonoma 14+ / Sequoia 15+, ARM64 Native)  
**Primary Runtime Stack:** Tauri 2.0 (Rust Core Engine) + Swift Native ANE Bridge + React 19 Desktop Frontend  

---

## 1. System Architecture & Component Decomposition

### 1.1 Architectural Rationale: Tauri 2.0 / Rust Core vs. React Native macOS
To achieve absolute zero-knowledge security, verifiable memory zeroization, and native Apple Neural Engine throughput, **Tauri 2.0 with a Rust Core Engine and Native Swift Bridging** is selected as the primary architectural runtime over React Native macOS:

1. **Deterministic Memory Lifecycles & Guaranteed Zeroization:**  
   JavaScript runtimes (V8, Hermes, JavaScriptCore) rely on non-deterministic Garbage Collection (GC). When cryptographic keys, passwords, or decrypted image pixel buffers enter JS memory, they may linger indefinitely in heap compaction pools, nursery spaces, or swap files. Rust provides strict RAII (`Drop` trait semantics), explicit virtual memory page locking (`mlock`), and deterministic memory scrubbing via the `zeroize` crate.
2. **SIMD & Cryptographic Throughput:**  
   Rust compiles directly to ARM64 machine code leveraging Apple Silicon NEON extensions for hardware-accelerated AES-NI and ChaCha20 vector instructions.
3. **Decoupled Architecture:**  
   The UI layer (React 19 / Vite / TanStack Virtual) executes within a hardened WebKit webview, receiving decrypted images strictly as ephemeral in-memory object URLs or custom scheme streaming channels (`aperture-stream://`), backed by Rust RAM buffers that never touch persistent disk.

### 1.2 System Decomposition Diagram

```
+---------------------------------------------------------------------------------------------------------+
|                                    PRESENTATION LAYER (WebKit / React 19)                               |
|  - Virtualized Timeline (TanStack Virtual / FlashList pattern)  - Dynamic Years/Months/Days Canvas      |
|  - Finder Multi-Column Explorer & EXIF Inspector                - Face Carousel & Natural Language Bar  |
+---------------------------------------------------------------------------------------------------------+
                                   │                              ▲
                                   │ Tauri 2.0 IPC (Binary Channels)
                                   ▼                              │
+---------------------------------------------------------------------------------------------------------+
|                               TAURI 2.0 RUST DESKTOP CORE (Native ARM64)                                 |
|                                                                                                         |
|  +───────────────────────────────────+  +──────────────────────────────────+                            |
|  |       MEMORY & LIFECYCLE GUARD     |  |       LOCAL WI-FI INGESTION      |                            |
|  | - `zeroize` on drop               |  | - Bonjour / mDNS Service         |                            |
|  | - `mlock` RAM pinning             |  | - Ephemeral TLS 1.3 Socket       |                            |
|  | - Screen lock / Sleep listeners   |  | - SAS 6-Digit PIN Pairing Engine |                            |
|  +───────────────────────────────────+  +──────────────────────────────────+                            |
|                                                                                                         |
|  +───────────────────────────────────+  +──────────────────────────────────+                            |
|  |       CRYPTOGRAPHIC ENGINE        |  |     ENCRYPTED DATABASE ENGINE    |                            |
|  | - Argon2id Key Derivation         |  | - SQLCipher (AES-256-CBC / HMAC) |                            |
|  | - AES-256-GCM / XChaCha20-Poly1305|  | - `sqlite-vec` (768-d Vector HNSW)                            |
|  | - Envelope Key Management         |  | - FTS5 OCR Tokenized Search      |                            |
|  +───────────────────────────────────+  +──────────────────────────────────+                            |
|                                                                                                         |
|  +─────────────────────────────────────────────────────────────────────────+                            |
|  |                     ENCRYPTED VIRTUAL FILE SYSTEM (EVFS)                |                            |
|  | - Chunked authenticated storage (`.aperture` container)                 |                            |
|  | - Streaming decryptor into RAM buffers (Zero unencrypted disk writes)   |                            |
|  +─────────────────────────────────────────────────────────────────────────+                            |
+---------------------------------------------------------------------------------------------------------+
                                   │                              ▲
                                   │ Swift C-FFI / `cxx` Bridge   │
                                   ▼                              │
+---------------------------------------------------------------------------------------------------------+
|                              NATIVE macOS SWIFT ACCELERATION SUBSYSTEM                                  |
|                                                                                                         |
|  +─────────────────────────+  +─────────────────────────+  +─────────────────────────────────────────+  |
|  |   VISION.FRAMEWORK      |  |     CORE ML / ANE       |  |       LOCALAUTHENTICATION.FRAMEWORK     |  |
|  | - Face Detection/Landmrk|  | - MobileCLIP-B (768-d)  |  | - Touch ID Biometrics                   |  |
|  | - Accurate Text OCR     |  | - Compute: ANE/GPU/CPU  |  | - Secure Enclave Key Wrap (kSecAccess)  |  |
|  +─────────────────────────+  +─────────────────────────+  +─────────────────────────────────────────+  |
+---------------------------------------------------------------------------------------------------------+
```

---

## 2. Hardware Acceleration & Apple Neural Engine (ANE) Specification

### 2.1 Unified Memory Architecture (UMA) Utilization
Apple Silicon (M1/M2/M3/M4) features a Unified Memory Architecture where CPU, GPU (Metal), and the Apple Neural Engine (ANE) share a high-bandwidth memory bus (up to 800 GB/s on Max/Ultra chips). The native Swift acceleration bridge exploits this by utilizing `CVPixelBuffer` references allocated in shared memory, preventing redundant memory copies between CPU preprocessing and ANE inference.

### 2.2 Computer Vision Subsystem (Apple Vision Framework)
The Swift acceleration bridge interfaces with macOS `Vision.framework` via a C-ABI export:

1. **Face Detection & Landmark Extraction:**
   - **Request:** `VNDetectFaceRectanglesRequest` combined with `VNDetectFaceLandmarksRequest`.
   - **Parameters:** `revision = VNDetectFaceRectanglesRequestRevision3`.
   - **Output:** Normalized bounding boxes (`CGRect`), yaw, roll, and 76 facial landmark points.
   - **Face Crop Normalization:** Face chips are cropped, scaled to 224x224, and normalized in-memory for facial feature extraction.
2. **Face Feature Vector Extraction (Embedding):**
   - **Model:** Quantized MobileFaceNet / FaceNet Core ML model targeting the ANE (`MLComputeUnits.all`).
   - **Embedding Dimension:** 512-dimensional L2-normalized floating-point vector.
   - **Clustering:** Embeddings are passed to Rust for incremental clustering using DBSCAN ($\varepsilon = 0.42$, $\text{MinPts} = 3$) with cosine distance.
3. **Optical Character Recognition (OCR):**
   - **Request:** `VNRecognizeTextRequest`.
   - **Configuration:** `recognitionLevel = .accurate`, `usesLanguageCorrection = true`, `recognitionLanguages = ["en-US", "ja-JP", "zh-Hans", "de-DE", "es-ES", "fr-FR"]`.
   - **Output:** Bounding boxes, text string tokens, confidence scores. Text strings are injected into the SQLCipher FTS5 index.

### 2.3 Semantic Natural Language Search Subsystem (Core ML / MobileCLIP)
To enable zero-cloud natural language queries ("red sports car parked in rain", "handwritten receipt from sushi restaurant"), Aperture Vault incorporates Apple's **MobileCLIP** architecture:

```
[ Natural Language Query: "hiking in pine forest" ]
                       │
                       ▼
       [ MobileCLIP Text Encoder (Core ML) ]  <── Runs on ANE (latency: ~8ms)
                       │
                       ▼
       [ Normalized Query Vector (768-d Float32) ]
                       │
                       ▼
    [ `sqlite-vec` Cosine Similarity Scan ]   <── Sub-20ms scan across 100,000 vectors
                       │
                       ▼
  [ Ranked Asset IDs returned to Gallery Grid ]
```

- **Model Selection:** `MobileCLIP-B (LT)` converted to Core ML FP16 package (`.mlpackage`).
- **Compute Unit Priority:** `MLModelConfiguration.computeUnits = .all` (delegating text and image encoders directly to the ANE).
- **Embedding Dimensions:** 768-dimensional normalized unit vector.
- **Image Ingestion Inference:** Upon asset ingestion, the decoded image buffer is resized to 256x256, center-cropped to 224x224, normalized to $[-1.0, 1.0]$, and processed through the MobileCLIP Vision Encoder on the ANE. Latency per image: $\approx 12\text{ ms}$ on M1, $\approx 6\text{ ms}$ on M3.

---

## 3. Cryptographic Specification

### 3.1 Key Derivation & Hierarchy

```
[ User Master Password ]
           │
           ▼
[ Argon2id KDF ] <── Salt: 32-byte CSRNG from `getrandom`
  (m=64MiB, t=3, p=4)
           │
           ├──────────────────────────────────────────┐
           ▼                                          ▼
[ Master Key Encryption Key (KEK) ]      [ Hardware Secure Enclave Enrollment ]
  (256-bit symmetric)                      (Touch ID / `LocalAuthentication`)
           │                                          │
           │                                          ▼
           │                             [ Enclave-Protected Key Wrap ]
           │                                          │
           ▼                                          ▼
+───────────────────────────────────────────────────────────+
|               VAULT MASTER KEY (VMK) (256-bit)            |
|       (Ephemeral in RAM; protected by `mlock` & `zeroize`) |
+───────────────────────────────────────────────────────────+
           │
           ├───────────────────────────────┬───────────────────────────────┐
           ▼                               ▼                               ▼
[ SQLCipher Database Key ]      [ Asset Encryption Key ]        [ Ingestion TLS Master ]
  HKDF-Expand(VMK, "db-key")      HKDF-Expand(VMK, AssetUUID)     HKDF-Expand(VMK, "tls")
```

1. **Master Password KDF (Argon2id):**
   - **Algorithm:** Argon2id (RFC 9106).
   - **Salt:** 32 bytes generated via OS cryptographically secure pseudorandom number generator (`SecRandomCopyBytes` / Rust `rand::rngs::OsRng`).
   - **Memory Cost ($m$):** 65,536 KiB (64 MiB).
   - **Time Cost ($t$):** 3 iterations.
   - **Parallelism ($p$):** 4 threads (optimized for Apple Silicon multi-performance cores).
   - **Output Length:** 32 bytes (256-bit KEK).
2. **macOS Keychain & Secure Enclave Integration:**
   - When Touch ID is enabled, an asymmetric ECC (NIST P-256) keypair is created inside the Secure Enclave via `kSecAttrTokenIDSecureEnclave`.
   - Access control flag: `kSecAccessControlBiometryAny | kSecAccessControlPrivateKeyUsage`.
   - Invalidation policy: Enforce `kSecAccessControlBiometryCurrentSet` so that enrolling or modifying system fingerprints immediately invalidates the biometric wrap, requiring master password fallback.
   - The Vault Master Key (VMK) is generated as 32 bytes of cryptographically secure random data upon vault creation. It is encrypted with the Enclave Key using AES-KeyWrap (RFC 3394) and stored in the vault metadata header.

### 3.2 Storage Encryption (Authenticated Cipher Suites)
Aperture Vault strictly prohibits unauthenticated ciphers. All data resting in the storage layer is cryptographically authenticated:

1. **Database Encryption (Metadata & Indexes):**
   - **Engine:** SQLCipher 4.x.
   - **Cipher:** AES-256-CBC with HMAC-SHA512 per page (4096-byte page size, 64,000 PBKDF2 iterations or raw key injection via `PRAGMA key`).
2. **Media Asset Payload Encryption:**
   - **Cipher Suite:** **AES-256-GCM** (NIST SP 800-38D) with fallback/stream option of **XChaCha20-Poly1305** for large video streams (> 100 MiB).
   - **Key:** Per-asset 256-bit Asset Key derived via `HKDF-SHA256(prk: VMK, info: "aperture-asset-v1:" || asset_uuid)`.
   - **Initialization Vector (IV):** 96-bit unique IV generated per asset from `OsRng`. Nonce reuse is strictly prohibited.
   - **Authentication Tag:** 128-bit Poly1305 / GCM tag appended to ciphertext.
   - **Container Chunking:** Assets $> 4\text{ MiB}$ are segmented into 64 KiB chunks, each with its own monotonic 32-bit counter appended to the nonce, preventing truncation or chunk-reordering attacks.

### 3.3 Memory Zeroization & Anti-Forensics
- **RAM Locking (`mlock`):** All buffers containing the Master Password, KEK, VMK, raw asset keys, and decrypted frame buffers are allocated via a custom allocator that calls `mlock()` to prevent the OS virtual memory subsystem from writing pages to disk swap (`/private/var/vm/swapfile*`).
- **Compiler Scrubbing (`zeroize`):** Sensitive Rust structs implement `zeroize::ZeroizeOnDrop`. Compilers are prevented from optimizing away zeroing operations via memory barriers (`core::sync::atomic::compiler_fence`).
- **Core Dump Disabling:** The process invokes `setrlimit(RLIMIT_CORE, &rlim { rlim_cur: 0, rlim_max: 0 })` and sets `ptrace(PT_DENY_ATTACH, 0, 0, 0)` on macOS to block unauthorized memory inspection.

---

## 4. Networking & Peer-to-Peer Synchronization Engine

### 4.1 Service Discovery via Bonjour / mDNS
Aperture Vault advertises its ingestion endpoint exclusively on the local network interface:
- **Service Type:** `_photovault._tcp.local.`
- **Domain:** `local.`
- **Transport:** TCP
- **Port:** Dynamically bound ephemeral port (range: `49152`–`65535`) to avoid port collisions and external probing.
- **TXT Record Payload:**
  ```ini
  v=1                                      ; Protocol version
  id=<VAULT_PUBLIC_UUID>                   ; Unique vault identifier
  name=Aperture Vault (Studio M3)          ; Human-readable node name
  fp=<SHA256_FINGERPRINT_TRUNC16>          ; Ephemeral cert fingerprint
  auth=sas6                                ; Supported auth: 6-digit SAS PIN
  ```

### 4.2 TLS 1.3 Ingestion Transport
- **Handshake:** TLS 1.3 enforced via Rust `rustls`. TLS 1.2 and earlier are strictly rejected.
- **Cipher Suites:** `TLS_AES_256_GCM_SHA384` and `TLS_CHACHA20_POLY1305_SHA256`.
- **Certificates:** The desktop vault generates an ephemeral self-signed X.509 certificate in RAM at startup. The certificate validity is restricted to 24 hours.

### 4.3 Out-of-Band Pairing: Short Authentication String (SAS)
To prevent Man-in-the-Middle (MitM) attacks on the local Wi-Fi network without requiring third-party PKI roots:
1. Mobile client connects to the desktop TLS socket.
2. During the TLS handshake, both parties extract the TLS 1.3 `ExporterMasterSecret` (RFC 8446 §7.5).
3. Both sides compute:
   $$\text{SAS} = \text{HKDF-Expand}(\text{ExporterMasterSecret}, \text{"aperture-pairing-sas"}, 4) \pmod{10^6}$$
4. The desktop UI displays the resulting 6-digit numeric PIN (e.g., `849 201`).
5. The mobile user verifies or enters the PIN. Once verified, an authorized session token is issued for file streaming.

### 4.4 Android & Cross-Platform Ingestion Analysis

```
                                  [ DISCOVERY & PAIRING ]
                                             │
                         ┌───────────────────┴───────────────────┐
                         ▼                                       ▼
                 [ Apple Ecosystem ]                    [ Android Ecosystem ]
                         │                                       │
            Native iOS Companion / Share Sheet           Wi-Fi TLS 1.3 Companion App
                         │                                       │
                         │                                (Fallback Mode)
                         │                                       │
                         │                         Local PWA via Ephemeral Web Server
                         │                                       │
                         └───────────────────┬───────────────────┘
                                             │
                                             ▼
                             [ TLS 1.3 Streaming Connection ]
                                             │
                                             ▼
                              [ SAS 6-Digit PIN Verification ]
                                             │
                                             ▼
                           [ Chunked Ingestion to Memory Buffer ]
```

1. **Android Quick Share Emulation Assessment:**  
   *Engineering Determination: REJECTED FOR PRODUCTION CORE.*  
   *Rationale:* Quick Share (formerly Nearby Share) utilizes Google's proprietary Play Services protocols, relying on Google identity servers for mutual device discovery and Wi-Fi Direct virtual interface manipulation. Emulation on macOS requires brittle reverse engineering of UKEY2 handshakes and unmaintained virtual network kernel extensions (`tuntap`), which violate macOS App Sandbox and Apple notarization requirements.
2. **Production Android Solution (Dual-Pronged):**
   - **Tier 1 (Android Companion App):** Lightweight native Kotlin client discovering `_photovault._tcp` via Android NsdManager, establishing the TLS 1.3 socket, performing the SAS handshake, and batch-uploading selected media files.
   - **Tier 2 (Zero-Install Local PWA Fallback):** The desktop engine serves an ephemeral lightweight Progressive Web App (PWA) over the local Wi-Fi port. The user scans a QR code displayed on the macOS desktop screen. The Android mobile browser connects, establishes an in-browser Web Crypto TLS connection, and streams photos via chunked `POST` requests directly into the desktop memory buffer.
