# Aperture Vault — UI / UX Design Brief

**Document Version:** 1.0.0-PROD  
**Author:** Principal Systems Architect & Lead Desktop Security Engineer  
**Target Platform:** macOS Sonoma 14+ / macOS Sequoia 15+  
**Design Standard:** Apple Human Interface Guidelines (HIG) Desktop Specification  

---

## 1. Design Philosophy & Visual Language

Aperture Vault is engineered to feel indistinguishable from a tier-one native macOS application. It marries the fluid, emotive discovery experience of Google Photos with the exacting, professional utility of the macOS Finder.

```
+───────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                    CORE VISUAL ATTRIBUTES & TOKENS                                        |
|                                                                                                           |
|  • Materials:        macOS NSVisualEffectView vibrancy; WebKit `backdrop-filter: blur(28px) saturate(190%)` |
|  • Color Palette:    Deep obsidian (`#0d0f12`) in dark mode; Dynamic system accents (`NSColor.controlAccent`)|
|  • Typography:       SF Pro Display (Headings, Years/Months), SF Pro Text (UI), SF Mono (EXIF / Hashes)   |
|  • Iconography:      Apple SF Symbols 6 vector assets with hierarchical rendering modes                   |
|  • Motion Physics:   macOS ProMotion (120Hz) spring curves (`stiffness: 340, damping: 32`)                |
+───────────────────────────────────────────────────────────────────────────────────────────────────────────+
```

### 1.1 macOS Desktop Chromatic System & Theming
- **Dark Mode (Default & Preferred):**
  - Background Base: `#0B0D0E` (Deep Charcoal Obsidian)
  - Surface Card / Tile: `#14171A` with `1px` border of `rgba(255, 255, 255, 0.08)`
  - Elevated Popovers / Modals: `#1C2024` with drop shadow `0 24px 48px rgba(0, 0, 0, 0.5)`
  - Text Primary: `rgba(255, 255, 255, 0.92)`
  - Text Secondary: `rgba(255, 255, 255, 0.60)`
  - Text Muted / Code: `rgba(255, 255, 255, 0.40)`
- **Vibrancy & Translucency:**
  - Sidebar: Translucent blur (`vibrancy-sidebar`), displaying wallpaper tint through the window hierarchy.
  - Floating Headers: Frosted glass sticky bars with micro-borders separating time epochs.

---

## 2. Layout Architecture & Anatomy

The application viewport adheres to a 3-pane responsive desktop structure:

```
+───────────────────────────────────────────────────────────────────────────────────────────────────────────+
|                                            UNIFIED TOOLBAR (48px)                                         |
| [Traffic Lights]  [View Switch: Cmd+1 / Cmd+2]    [Global Search: Cmd+K]    [Wi-Fi Sync]   [Lock: Cmd+L]  |
+─────────────────────┬─────────────────────────────────────────────────────┬───────────────────────────────+
|                     |                                                     |                               |
|   SIDEBAR (240px)   |               PRIMARY VIEWPORT CANVAS               |   INSPECTOR SIDEBAR (320px)   |
|   (Collapsible)     |                                                     |   (Toggleable: Cmd+I)         |
|                     |  • View 1: Google Photos Replica (Timeline Grid)    |                               |
|  • Library          |    - Years / Months / Days Zoom Levels              |  • Histogram & Preview        |
|  • People & Pets    |    - Sticky Geocoded Date Headers                   |  • Photographic Parameters    |
|  • Places Map       |    - People Carousel & Face Clustering Strip        |  • Geolocation & Address      |
|  • Albums           |                                                     |  • Cryptographic Checksum     |
|  • File Explorer    |  • View 2: File Manager Mode (Finder Multi-Column)  |  • AES-256-GCM Verification   |
|  • Device Sync      |    - Sortable table, sizes, raw formats, tags       |                               |
|                     |                                                     |                               |
+─────────────────────┴─────────────────────────────────────────────────────┴───────────────────────────────+
|                                           STATUS BAR (24px)                                               |
| 52,419 Items • 412.8 GB Encrypted • Apple Neural Engine Ready • Local Wi-Fi Ingestion Active              |
+───────────────────────────────────────────────────────────────────────────────────────────────────────────+
```

---

## 3. View 1: Google Photos Experience ("Canvas Mode" — `Cmd + 1`)

View 1 is optimized for visual browsing, temporal exploration, and high-velocity discovery.

### 3.1 Multi-Tier Pinch-to-Zoom Gesture Architecture
The grid supports multi-touch trackpad pinch gestures, transitioning smoothly across three temporal granularities with continuous layout interpolation:

```
[ PINCH IN ]                                                                      [ PINCH OUT ]
◄─────────────────────────────────────────────────────────────────────────────────────────────►
Years View (Macro)               Months View (Mesoscopic)               Days View (Granular)
• 3–4 columns per row            • 5–6 columns per row                 • 8–10 columns per row
• 1 curated hero photo per year  • Grouped by Calendar Month           • Individual photo thumbnails
• High-level temporal jump       • Prominent city location badges      • Full chronological fidelity
```

- **Pinch Physics:** Trackpad pinch gestures continuously scale thumbnail geometries in real-time. When pinch scale crosses threshold $\Delta > 1.35$, the virtualized index recalculates row heights and smoothly morphs into the target zoom tier.
- **Micro-Thumbnail Placeholders:** Off-screen images display an ultra-compact 32-bit BlurHash / micro-thumbnail stored in SQLCipher, ensuring zero blank squares during 120Hz rapid scrolling.

### 3.2 Sticky Reverse-Geocoded Timeline Headers
As the user scrolls vertically, section headers float over the grid, pinning to the top edge until pushed out by the next temporal block:
- **Header Formatting:**
  `[Month Day, Year] • [City / Landmark], [Country]`  
  *Example:* `October 24, 2024 • Higashiyama, Kyoto, Japan`
- **Reverse Geocoding Resolution:** Evaluated offline via an embedded SQLite database of 150,000 global cities and administrative regions, querying the asset's GPS coordinates via a localized R-Tree index.

### 3.3 People & Pets Face Strip
Positioned optionally above the timeline or accessible via the People tab:
- **Anatomy:** Horizontal scrolling carousel of circular face chips (64px diameter).
- **Interactions:**
  - Single Click: Filters the timeline instantaneously to show only media containing that individual.
  - Double Click / Right Click: Opens inline text field to assign or edit the person's name (e.g., *"Eleanor"*).
  - Unnamed Face Grouping: Grouped automatically by ANE 512-d embedding clustering with a prompt: *"Who is this?"*.

### 3.4 Natural Language Semantic Search Bar
Located in the unified toolbar (`Cmd + K` or `/`):
- **Input Design:** Pill-shaped glass container with an animated magnifying glass SF Symbol.
- **Search Capabilities:**
  - Freeform natural language queries: *"receipts from hotel"*, *"black cat sitting in window"*, *"hiking snowy mountain"*.
  - Tokenized filter pills: `type:video`, `camera:Sony A7IV`, `face:Eleanor`, `city:Berlin`.
- **Query Execution:** As the user finishes typing (debounced at 120ms), the query string is encoded on the ANE via MobileCLIP Text Encoder, generating a 768-d vector that queries `sqlite-vec`. Ranked results appear below the search bar in $< 35\text{ ms}$.

---

## 4. View 2: File Manager Mode ("Inspector Mode" — `Cmd + 2`)

View 2 transforms the gallery into a high-precision, multi-column desktop file manager engineered for power users, photographers, and forensic archivists.

### 4.1 Multi-Column Finder Table
The central viewport renders a high-density, virtualized data table:

| Name | Capture Date | Date Added | File Size | Format | Dimensions | ISO | Shutter | F-Stop | Camera Model |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `DSC_9012.NEF` | 2024-10-24 14:02:11 | 2024-10-25 09:12 | 48.4 MB | RAW (NEF) | 8256 × 5504 | 64 | 1/2500s | f/2.8 | Nikon Z9 |
| `IMG_4410.HEIC`| 2024-10-24 12:30:45 | 2024-10-25 09:12 | 3.1 MB | HEIC | 4032 × 3024 | 100 | 1/120s | f/1.8 | iPhone 16 Pro |
| `PRO_0042.MOV` | 2024-10-23 18:45:00 | 2024-10-25 09:13 | 1.84 GB | ProRes 422 | 3840 × 2160 | 400 | 1/50s | f/4.0 | Sony FX3 |

- **Table Interactions:**
  - Multi-column sorting (Click column header to cycle: Ascending $\rightarrow$ Descending $\rightarrow$ Default).
  - Column reordering via drag-and-drop.
  - Multi-selection: `Shift + Click` (range selection), `Cmd + Click` (disjoint selection), rubber-band marquee drag.

### 4.2 Deep EXIF & Cryptographic Inspector Sidebar (`Cmd + I`)
When an asset is selected, the right sidebar renders a deep-dive forensic inspector:

```
+───────────────────────────────────────────────────────────+
|               COLLAPSIBLE INSPECTOR (Cmd + I)             |
+───────────────────────────────────────────────────────────+
| [ IMAGE PREVIEW & RGB HISTOGRAM ]                         |
|   [ 240x160 Decrypted In-Memory Preview ]                 |
|   [ R / G / B / Luminance Dynamic Curve Graph ]           |
+───────────────────────────────────────────────────────────+
| OPTICAL & SENSOR PARAMETERS                               |
| • Exposure:     1/2500 sec at f/2.8                       |
| • Sensitivity:  ISO 64                                    |
| • Focal Length: 70.0 mm (70mm 35mm equivalent)            |
| • Lens Model:   NIKKOR Z 70-200mm f/2.8 VR S              |
| • Metering:     Multi-segment                             |
| • Flash:        Did not fire                              |
+───────────────────────────────────────────────────────────+
| GEOLOCATION & MUNICIPAL DATA                              |
| • Coordinates:  35.0116° N, 135.7681° E                   |
| • Altitude:     48.2 meters above sea level               |
| • Location:     Kyoto, Kansai, Japan                      |
| • Geohash:      xn0x1j6m                                  |
| [ Mini Vector Map Tile with Pin ]                         |
+───────────────────────────────────────────────────────────+
| CRYPTOGRAPHIC & STORAGE AUDIT                             |
| • Asset UUID:   bcca5448-c918-4fcb-94d4-98e500926632      |
| • Cipher Suite: AES-256-GCM (NIST SP 800-38D)             |
| • BLAKE3 Hash:  8f9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d...       |
| • Nonce / IV:   96-bit (Unique verified)                  |
| • MAC Tag:      16 bytes (Authenticated)                  |
| • Disk Status:  Encrypted Blob (`.aev`)                   |
+───────────────────────────────────────────────────────────+
```

---

## 5. Keyboard Shortcuts & Quick Actions Reference Table

To guarantee rapid ergonomics, all primary operations are mapped to macOS standard keyboard shortcuts:

| Shortcut | Action Description | Context / Scope |
| :--- | :--- | :--- |
| **`Cmd + L`** | **Emergency Vault Lock & RAM Zeroization** | Global (Immediate execution) |
| **`Cmd + 1`** | Switch to **Gallery Timeline View** (Canvas Mode) | Global |
| **`Cmd + 2`** | Switch to **File Manager View** (Multi-Column Mode) | Global |
| **`Cmd + 3`** | Open **People & Pets Explorer** | Global |
| **`Cmd + 4`** | Open **Places & Spatial Map View** | Global |
| **`Cmd + K`** or **`/`** | Focus **Natural Language Search Bar** | Global |
| **`Cmd + I`** | Toggle **Collapsible EXIF & Cryptographic Inspector** | Active Session |
| **`Space`** | **QuickLook In-Memory Preview** (Full resolution) | Selected Asset |
| **`Cmd + +`** | Zoom In Grid (Days $\rightarrow$ High Density) | Gallery View |
| **`Cmd + -`** | Zoom Out Grid (Days $\rightarrow$ Months $\rightarrow$ Years) | Gallery View |
| **`Cmd + A`** | Select All Assets in Current Scope | Active View |
| **`Cmd + E`** | Export Selected Assets (Plain or Encrypted Archive) | Selection |
| **`Cmd + Delete`** | Move Selected Assets to Encrypted Trash | Selection |
| **`Cmd + Shift + G`**| **Batch Strip GPS Metadata** from Selected Assets | Selection |
| **`Cmd + R`** | Refresh Wi-Fi Ingestion Socket & Peer Broadcast | Global |
| **`Esc`** | Clear Selection / Dismiss Modal / Exit Fullscreen | Modal / Selection |
