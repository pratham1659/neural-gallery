# Core Algorithms & Mathematical Formulations

This document provides a mathematical and algorithmic breakdown of the computer vision, perceptual hashing, clustering, and heuristic pipelines implemented in Neural Gallery.

---

## 1. Perceptual Difference Hashing (`dhash`)

Neural Gallery uses the **Difference Hash (`dhash`)** algorithm via `imagehash` for 64-bit perceptual image fingerprinting. Unlike cryptographic hashes (SHA-256) where a single flipped bit produces an entirely disparate digest, `dhash` produces bit patterns that correlate directly with structural visual content.

```
Original Image (Any Size)
          │
          ▼
1. Grayscale Conversion (Luminance Y = 0.299R + 0.587G + 0.114B)
          │
          ▼
2. Bilinear Downsampling to 9 x 8 Pixels
          │
          ▼
3. Horizontal Gradient Comparison (64 comparisons)
   Bit[y * 8 + x] = 1 if Pixel[x, y] > Pixel[x + 1, y] else 0
          │
          ▼
64-Bit Binary Integer -> 16-Character Hexadecimal Digest
```

### Algorithmic Properties
* **Resolution Independence:** Resizing to $9 \times 8$ discards high-frequency pixel variations while preserving macro structural gradients.
* **Aspect Ratio Invariance:** Images stretched or re-encoded to different dimensions retain identical gradient polarities.
* **Monotonic Color Shift Immunity:** Uniform brightness or contrast adjustments do not alter relative pixel inequalities ($P_{x, y} > P_{x+1, y}$).

---

## 2. Near-Duplicate Clustering & Banded LSH

Photos are classified as near-duplicates if their 64-bit dhash signatures differ by a Hamming distance within threshold $\tau = 8$:

$$\Delta_H(H_1, H_2) = \sum_{i=0}^{63} \left( H_1[i] \oplus H_2[i] \right) = \text{popcount}(H_1 \oplus H_2)$$

### 2.1. Disjoint-Set Union (Union-Find)

To group duplicates transitively (if $A \approx B$ and $B \approx C$, then $A, B, C$ share a cluster), Neural Gallery uses Disjoint-Set Union with path compression:

```python
parent = {file_id: file_id for file_id, _ in items}

def find(file_id: int) -> int:
    while parent[file_id] != file_id:
        parent[file_id] = parent[parent[file_id]]  # Path halving
        file_id = parent[file_id]
    return file_id

def union(left: int, right: int) -> None:
    root_left, root_right = find(left), find(right)
    if root_left != root_right:
        parent[root_right] = root_left
```

### 2.2. Dual-Mode Complexity Scaling

Exhaustive pairwise comparison requires $\binom{N}{2} = \frac{N(N-1)}{2}$ comparisons ($O(N^2)$). For personal libraries up to 8,000 photos, this takes $< 0.4$ seconds in memory. Beyond `PAIRWISE_LIMIT = 8000`, Neural Gallery transitions to **Banded Locality-Sensitive Hashing (LSH)**:

```
64-bit dhash
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┐
│  Band 0 (16-bit) │  Band 1 (16-bit) │  Band 2 (16-bit) │  Band 3 (16-bit) │
│   bits 63..48    │   bits 47..32    │   bits 31..16    │    bits 15..0    │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

1. **Band Iteration:** The 64-bit hash is split across four 16-bit bands (`shift ∈ {48, 32, 16, 0}`).
2. **Bucket Partitioning:** Items with identical 16-bit integers in the active band are hashed into hash tables (`buckets[(digest >> shift) & 0xFFFF]`).
3. **Pruning Constraints:**
   * Buckets with $|B| < 2$ are skipped (no candidate pairs).
   * Buckets with $|B| > 400$ are skipped to prevent pathological comparisons on blank or uniformly black images.
4. **Targeted Comparison:** Full 64-bit Hamming checks are performed only within qualified buckets.

---

## 3. Apple Vision Face Recognition Pipeline

Face detection and clustering leverage Apple Silicon hardware acceleration natively via PyObjC.

### 3.1. Vision Coordinate Inversion & Crop Geometry

Apple Vision normalizes bounding box coordinates in the range $[0.0, 1.0]$ with an **inverted origin at the bottom-left** of the image:

```
Apple Vision Space (Origin: Bottom-Left)      PIL / Screen Space (Origin: Top-Left)
(0, 1) +-----------------------+ (1, 1)       (0, 0) +-----------------------+ (1, 0)
       |                       |                     |       y_pil           |
       |     +--------+        |                     |     +--------+        |
       |     |  Face  | h      |                     |     |  Face  |        |
       |     +--------+        |                     |     +--------+        |
       |   (x, y)   w          |                     |                       |
(0, 0) +-----------------------+ (1, 0)       (0, 1) +-----------------------+ (1, 1)
```

To crop face regions safely without cutting off chins or hair, `crop_box` translates coordinates to pixel space and expands the box by $25\%$ padding ($\text{pad} = 0.25$):

$$\text{pixel\_w} = \max(1, \lfloor w \cdot W \rfloor), \quad \text{pixel\_h} = \max(1, \lfloor h \cdot H \rfloor)$$

$$\text{grow\_x} = \lfloor \text{pixel\_w} \cdot \text{pad} \rfloor, \quad \text{grow\_y} = \lfloor \text{pixel\_h} \cdot \text{pad} \rfloor$$

$$\text{left} = \max(0, \lfloor x \cdot W \rfloor - \text{grow\_x})$$

$$\text{top} = \max(0, \lfloor (1.0 - y - h) \cdot H \rfloor - \text{grow\_y})$$

$$\text{right} = \min(W, \text{left} + \text{pixel\_w} + 2 \cdot \text{grow\_x})$$

$$\text{bottom} = \min(H, \text{top} + \text{pixel\_h} + 2 \cdot \text{grow\_y})$$

If the resulting crop is smaller than $24 \times 24$ pixels, it is discarded as noise.

### 3.2. Vision Feature Print Vector Normalization

Cropped face patches are passed to `VNGenerateImageFeaturePrintRequest`. The observation yields an unmanaged float32 byte array which is converted to an L2-normalized 512-dimensional vector:

$$\mathbf{v} = \frac{\mathbf{x}}{\|\mathbf{x}\|_2} = \frac{\mathbf{x}}{\sqrt{\sum_{i=1}^{512} x_i^2}}$$

### 3.3. Online Centroid Clustering

Clustering operates in an incremental online fashion with cosine distance metric ($d(\mathbf{u}, \mathbf{c}) = 1.0 - \mathbf{u} \cdot \mathbf{c}$):

1. **Centroid Initialization:** For existing clusters, compute running centroid vectors $\mathbf{c}_k$ and instance counters $n_k$.
2. **Nearest Cluster Search:** For an unassigned vector $\mathbf{u}$, compute:
   $$k^* = \arg\min_{k} \left( 1.0 - \mathbf{u} \cdot \mathbf{c}_k \right)$$
3. **Threshold Evaluation:**
   * If $d(\mathbf{u}, \mathbf{c}_{k^*}) \le \text{MATCH\_DISTANCE}$ (default $0.34$):
     * Assign face to cluster $k^*$.
     * Update running centroid using Welford-style incremental averaging:
       $$\mathbf{c}_{k^*}^{(t)} = \mathbf{c}_{k^*}^{(t-1)} + \frac{\mathbf{u} - \mathbf{c}_{k^*}^{(t-1)}}{n_{k^*} + 1}, \quad n_{k^*} \leftarrow n_{k^*} + 1$$
   * If distance exceeds $0.34$:
     * Create new cluster $k_{\text{new}} = \text{"p"}\parallel\text{face\_id}$.
     * Initialize $\mathbf{c}_{k_{\text{new}}} = \mathbf{u}, \, n_{k_{\text{new}}} = 1$.

---

## 4. Heuristic Suggestion Engine (`neural_gallery.learn`)

The suggestion engine computes candidate predictions without training or loading neural network weights:

1. Let $K = \{dhash(f) \mid f \in \text{files}, \text{label} = \text{'keep'}\}$
2. Let $N = \{dhash(f) \mid f \in \text{files}, \text{label} = \text{'noise'}\}$
3. For an unlabeled photo with hash $d$:
   $$d_{keep} = \min_{h \in K} \Delta_H(d, h), \quad d_{noise} = \min_{h \in N} \Delta_H(d, h)$$
4. Decision Boundaries (`MARGIN = 4`):
   * If $d_{noise} + 4 < d_{keep} \implies \text{Suggest } \textbf{Noise}$
   * If $d_{keep} + 4 < d_{noise} \implies \text{Suggest } \textbf{Keep}$
   * If $|d_{keep} - d_{noise}| \le 4$ and photo is a screenshot:
     * If $d_{keep} \ge d_{noise} \implies \text{Suggest } \textbf{Noise}$
     * Otherwise $\implies \textbf{None}$ (ambiguous)

---

## 5. Screenshot Detection Heuristic

Screenshot classification uses multi-stage deterministic filtering:

```python
def looks_like_screenshot(path: Path, width: int, height: int, has_camera: bool, has_taken: bool) -> bool:
    # Stage 1: Filename Substring Detection
    name = path.name.lower().replace("_", " ").replace("-", " ")
    if "screenshot" in name or "screen shot" in name:
        return True

    # Stage 2: Metadata and Format Verification
    if path.suffix.lower() != ".png" or has_camera or has_taken or width <= 0 or height <= 0:
        return False

    # Stage 3: Display Aspect Ratio Bounding
    long_side = max(width, height)
    short_side = min(width, height)
    aspect = long_side / short_side
    return 1.7 <= aspect <= 2.4
```

### Explanation of Aspect Ratio Range $[1.7, 2.4]$
Common consumer screen resolutions fall within this ratio:
* $16:9 \approx 1.777$ (Traditional monitors, laptops, older iPhones)
* $16:10 = 1.600$ (Older MacBooks)
* $19.5:9 \approx 2.166$ (iPhone X through 16 Pro)
* $20:9 \approx 2.222$ (Modern Android flagships)
* $21:9 \approx 2.333$ (Ultra-wide cinema displays)
Digital camera sensors produce $3:2$ ($1.500$) or $4:3$ ($1.333$) aspect ratios, which are cleanly rejected by this filter.

