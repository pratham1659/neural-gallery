# Aperture Vault — Phased Implementation Plan

**Document Version:** 1.0.0-PROD  
**Author:** Principal Systems Architect & Lead Desktop Security Engineer  
**Execution Runtime:** Antigravity Agentic IDE (Tauri 2.0 / Rust + Swift + React 19)  
**Target Hardware:** Apple Silicon (macOS Sonoma / Sequoia, ARM64)  

---

## Roadmap & Milestone Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: Security Core & Database Scaffolding                                               │
│ • Argon2id KDF • AES-256-GCM EVFS • SQLCipher + sqlite-vec • Secure Enclave Touch ID        │
└──────────────────────────────┬──────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: Local Wi-Fi Ingestion Engine & Discovery                                           │
│ • Bonjour mDNS Service • TLS 1.3 Rustls Server • SAS 6-Digit PIN • Fallback PWA Server      │
└──────────────────────────────┬──────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: Apple Silicon Native Vision & Core ML Bridge                                       │
│ • Swift C-ABI Bridge • Apple Vision Face & OCR • MobileCLIP ANE Pipeline • DBSCAN Clustering│
└──────────────────────────────┬──────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: Frontend Development (Tauri 2.0 + React 19)                                        │
│ • macOS Vibrancy Window • Touch ID Modal • Virtualized Timeline • Dual-Mode File Manager    │
└──────────────────────────────┬──────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: Verification, Benchmarking & Leak Testing                                          │
│ • LLDB Core Dump Memory Audit • Disk Leak Verification • 120fps Scroll & Cold-Start Tests   │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Security Core & Database Scaffolding

### 1.1 Objective & Scope
Construct the cryptographic root-of-trust, memory isolation layer, encrypted container storage driver (EVFS), and encrypted SQLCipher + `sqlite-vec` database engine in Rust.

### 1.2 Actionable Subtasks
1. **Cryptographic Primitives Module (`src-tauri/src/crypto/`):**
   - Implement `Argon2id` key derivation with parameters: $m=64\text{ MiB}, t=3, p=4$.
   - Wrap sensitive buffers in `zeroize::ZeroizeOnDrop` and pin pages using libc `mlock`.
   - Implement AES-256-GCM chunked stream encryption with 96-bit random IVs and 128-bit Poly1305/GCM tags.
2. **macOS LocalAuthentication & Keychain Bridge (`src-tauri/native/keychain/`):**
   - Implement Swift native bridge invoking `LAContext.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics)`.
   - Implement Secure Enclave key generation with `kSecAccessControlBiometryCurrentSet` to wrap the Vault Master Key (VMK).
3. **Encrypted Storage Driver (EVFS) (`src-tauri/src/storage/`):**
   - Implement atomic writer for encrypted container blobs (`.aev`) using temporary in-memory buffers and atomic `rename(2)`.
   - Implement streaming decryptor feeding memory buffers without intermediate disk staging.
4. **SQLCipher & `sqlite-vec` Scaffolding (`src-tauri/src/db/`):**
   - Link native SQLCipher 4.6+ with WAL mode and memory PRAGMAs.
   - Compile and link `sqlite-vec` extension statically into the SQLite connection pool.
   - Execute DDL migrations (`media_assets`, `persons`, `face_instances`, `asset_ocr`, `vec_embeddings`, `spatial_index`).

### 1.3 Verification Commands & Test Assertions
```bash
# 1. Run unit tests for Argon2id, AES-256-GCM, and memory zeroization
cargo test --package aperture-core --lib crypto::tests

# 2. Assert that dropped secrets are zeroized in memory (compile with asan/msan if needed)
cargo test --package aperture-core --lib crypto::tests::test_key_zeroization -- --exact

# 3. Verify SQLCipher file encryption (inspect raw header: must NOT match standard SQLite magic bytes)
cargo test --package aperture-core --lib db::tests::test_encrypted_database_header
```

### 1.4 Definition of Done (DoD)
- Zero bytes of unencrypted keys or plain SQLite headers visible on disk.
- Unit tests verify Argon2id matches official RFC 9106 test vectors.
- SQLCipher rejects any attempt to open without the raw HKDF key.

---

## Phase 2: Local Wi-Fi Ingestion Engine & Discovery

### 2.1 Objective & Scope
Build the air-gapped peer-to-peer Wi-Fi synchronization service utilizing Bonjour/mDNS, TLS 1.3 ephemeral sockets, 6-digit SAS pairing, and multi-platform upload handling.

### 2.2 Actionable Subtasks
1. **Bonjour / mDNS Daemon (`src-tauri/src/network/mdns.rs`):**
   - Implement service advertisement for `_photovault._tcp.local.` using `libmdns` or native `DNSServiceRegister`.
   - Broadcast TXT records: `v=1`, `id=<vault_uuid>`, `fp=<cert_fingerprint>`, `auth=sas6`.
2. **Ephemeral TLS 1.3 Socket Server (`src-tauri/src/network/tls_server.rs`):**
   - Generate ephemeral in-memory self-signed X.509 certificate and private key at session startup.
   - Configure `rustls` to enforce TLS 1.3 (`TLS_AES_256_GCM_SHA384` and `TLS_CHACHA20_POLY1305_SHA256`).
   - Bind dynamically to an unassigned ephemeral port (`0.0.0.0:0` on local interface only).
3. **Out-of-Band SAS Pairing Protocol (`src-tauri/src/network/pairing.rs`):**
   - Extract TLS 1.3 `ExporterMasterSecret` and derive 6-digit numeric Short Authentication String (SAS).
   - Expose SAS verification event to Tauri frontend for desktop confirmation.
4. **Chunked Stream Ingestion & PWA Fallback (`src-tauri/src/network/ingest.rs`):**
   - Stream incoming media packets directly into pinned `mlock` ring buffers.
   - Parse EXIF, compute BLAKE3 digest, encrypt via AES-256-GCM, and stage SQLCipher transaction.
   - Serve lightweight local PWA assets over HTTP/TLS for zero-install Android browser uploads.

### 2.3 Verification Commands & Test Assertions
```bash
# 1. Discover active mDNS advertisement on local subnet
dns-sd -B _photovault _tcp local.

# 2. Verify TLS 1.3 handshake negotiation and cipher suite
openssl s_client -connect 127.0.0.1:<PORT> -tls1_3

# 3. Simulate chunked file ingestion via mock TLS client and verify 0 disk leaks
cargo test --package aperture-core --lib network::tests::test_airgapped_ingestion_pipeline
```

### 2.4 Definition of Done (DoD)
- mDNS correctly resolves on macOS and mobile clients without network configuration.
- Connections without valid SAS PIN confirmation are immediately dropped within 5 seconds.
- Ingested files flush directly to encrypted `.aev` blocks without temporary disk file generation.

---

## Phase 3: Apple Silicon Native Vision & Core ML Bridge

### 3.1 Objective & Scope
Integrate Apple Vision framework and Core ML with the Apple Neural Engine (ANE) via a Swift C-ABI bridge to perform offline face detection, OCR, and MobileCLIP vector embeddings.

### 3.2 Actionable Subtasks
1. **Swift C-ABI Native Dynamic Library (`src-tauri/native/vision_bridge/`):**
   - Create Swift module compiled with `-O -whole-module-optimization` producing `libaperture_vision.dylib`.
   - Expose C-callable function pointers:
     - `aperture_detect_faces(const uint8_t* buffer, size_t len, FaceCallback cb)`
     - `aperture_extract_ocr(const uint8_t* buffer, size_t len, OcrCallback cb)`
     - `aperture_embed_clip_image(const uint8_t* buffer, size_t len, float* out768)`
     - `aperture_embed_clip_text(const char* query, float* out768)`
2. **Apple Vision Face Detection & Quality (`VisionBridge.swift`):**
   - Dispatch `VNDetectFaceRectanglesRequest` (Revision 3) and `VNDetectFaceLandmarksRequest`.
   - Extract normalized bounding boxes and face chips (224x224).
3. **Apple Vision OCR Extraction (`OcrBridge.swift`):**
   - Dispatch `VNRecognizeTextRequest` with `.accurate` recognition level and multi-language support.
   - Return concatenated string tokens for SQLite FTS5 ingestion.
4. **MobileCLIP Core ML Inference (`ClipBridge.swift`):**
   - Package quantized MobileCLIP-B model into Core ML `.mlpackage`.
   - Configure compute units to `MLModelConfiguration.computeUnits = .all` (targeting ANE).
   - Generate normalized 768-d unit vectors from image buffers and text queries.
5. **Clustering & Vector Ingestion (`src-tauri/src/ai/`):**
   - Implement incremental DBSCAN clustering in Rust over 512-d face vectors.
   - Insert 768-d MobileCLIP vectors into `vec_embeddings` using `sqlite-vec`.

### 3.3 Verification Commands & Test Assertions
```bash
# 1. Compile Swift native bridge
swiftc -emit-library -O -module-name aperture_vision \
  src-tauri/native/vision_bridge/*.swift \
  -o src-tauri/target/libaperture_vision.dylib

# 2. Run benchmark test verifying ANE execution latency (< 20ms per image)
cargo test --package aperture-core --lib ai::tests::test_ane_inference_latency -- --nocapture

# 3. Test natural language vector search over sqlite-vec
cargo test --package aperture-core --lib ai::tests::test_semantic_vector_search
```

### 3.4 Definition of Done (DoD)
- Face detection, OCR, and CLIP embeddings execute 100% locally with zero internet requests.
- MobileCLIP inference completes in $< 20\text{ ms}$ per image on Apple Silicon M-series.
- Vector search returns ranked nearest neighbors across 50,000 vectors in $< 35\text{ ms}$.

---

## Phase 4: Frontend Presentation Layer (Tauri 2.0 + React 19)

### 4.1 Objective & Scope
Construct the high-performance macOS desktop user interface adhering to Apple Human Interface Guidelines (HIG), featuring a virtualized multi-tier timeline, dual-mode file manager, and deep EXIF inspector.

### 4.2 Actionable Subtasks
1. **macOS Native Window Scaffolding (`src-tauri/tauri.conf.json`):**
   - Configure native window styling: `titleBarStyle = "Overlay"`, `transparent = true`, vibrancy = `"sidebar"`.
   - Map macOS system menu actions and global keyboard shortcuts (`Cmd+L`, `Cmd+1`, `Cmd+2`, `Cmd+I`, `Cmd+K`).
2. **Master Unlock & Biometric Screen (`src/components/auth/`):**
   - Implement biometric Touch ID prompt with fallback to Master Password input.
   - Display Argon2id derivation progress indicator with zero plain text leaks.
3. **Virtualized Timeline Engine (`src/components/gallery/`):**
   - Implement high-density virtualized grid (TanStack Virtual / FlashList architecture).
   - Implement continuous pinch-to-zoom gesture handler (Years $\leftrightarrow$ Months $\leftrightarrow$ Days).
   - Implement frosted glass sticky date/location headers.
   - Integrate BlurHash and micro-thumbnail in-memory rendering.
4. **Finder-Grade File Manager Mode (`src/components/explorer/`):**
   - Implement multi-column sortable table (Filename, Date, Size, Format, ISO, Shutter, Lens).
   - Build collapsible EXIF / Cryptographic Inspector Sidebar (`Cmd + I`).
   - Support multi-selection (`Shift + Click`, `Cmd + Click`, rubber-band drag).
5. **Smart Discovery Bars (`src/components/search/`):**
   - Build Natural Language Search input with instant semantic vector query execution.
   - Build People & Pets face carousel with inline naming.

### 4.3 Verification Commands & Test Assertions
```bash
# 1. Run frontend type check and lint
pnpm tsc --noEmit && pnpm lint

# 2. Run Storybook / component unit tests
pnpm test:components

# 3. Launch Tauri 2.0 development build on macOS
pnpm tauri dev
```

### 4.4 Definition of Done (DoD)
- Window renders native macOS vibrancy and traffic light insets seamlessly.
- Timeline maintains steady 60–120 fps during continuous inertial scrolling on ProMotion displays.
- Mode switching between Gallery (`Cmd+1`) and File Manager (`Cmd+2`) occurs in $< 16\text{ ms}$ without reloading data.

---

## Phase 5: Verification, Benchmarking & Leak Testing

### 5.1 Objective & Scope
Perform exhaustive security audits, memory zeroization validation, disk leak detection, and performance benchmarks to certify the build for production release.

### 5.2 Actionable Subtasks
1. **Memory Zeroization & Anti-Forensics Audit:**
   - Execute vault lock (`Cmd + L`).
   - Generate full process memory core dump via `lldb` / `gcore`.
   - Scan binary dump for Master Password strings, VMK byte sequences, and decrypted JPEG/HEIC headers.
2. **Disk Leak Audit (Zero Plaintext Disk Writes):**
   - Monitor macOS filesystem activity using `fs_usage` during ingestion and playback.
   - Verify that `/tmp`, `NSTemporaryDirectory()`, and `/private/var/folders/` receive zero decrypted bytes.
3. **Virtualized Scroll & Latency Benchmark:**
   - Ingest 50,000 synthetic test assets (mixed HEIC, RAW, MOV).
   - Benchmark cold-launch-to-unlocked latency using macOS `os_signpost` / Instruments.
   - Measure frame times during rapid trackpad scrubbing using Quartz Debug / Metal System Trace.

### 5.3 Verification Commands & Test Assertions
```bash
# 1. Inspect memory dump for plaintext cryptographic leakage post-lock
lldb --batch \
  -o "process attach --name ApertureVault" \
  -o "process save-core /tmp/vault_dump.core" \
  -o "quit"

# Scan core dump for known test passphrase or raw magic bytes
strings /tmp/vault_dump.core | grep -i "SuperSecretMasterPassphrase" || echo "PASS: Memory Zeroized"

# 2. Monitor disk writes during bulk ingestion (must show 0 writes to /tmp or unencrypted paths)
sudo fs_usage -w -f filesys ApertureVault | grep -E "(\.tmp|NSTemporaryDirectory|/private/var)"

# 3. Execute automated 50,000 asset virtual scroll benchmark
pnpm test:perf:scroll-benchmark
```

### 5.4 Definition of Done (DoD)
- Cold launch to unlocked timeline measures **$< 1,200\text{ ms}$**.
- Zero occurrences of plaintext secrets or decrypted media headers found in `lldb` memory dumps.
- `fs_usage` confirms 100% of persistent disk writes are authenticated `.aev` ciphertext or SQLCipher pages.
- Virtualized scrolling maintains **60–120 fps** with zero dropped frame warnings over 50,000 items.
