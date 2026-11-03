"""Native Swift bridge bindings for Apple Silicon hardware acceleration.

Calls `libneural_bridge.dylib` directly over C-ABI to interface with Apple Vision,
Core ML / Apple Neural Engine (ANE), and LocalAuthentication Touch ID.
"""

import ctypes
from pathlib import Path

_DYLIB_PATH = Path(__file__).resolve().parent.parent / "native" / "build" / "libneural_bridge.dylib"
_LIB = None

if _DYLIB_PATH.is_file():
    try:
        _LIB = ctypes.CDLL(str(_DYLIB_PATH))

        # int32_t neural_detect_faces(const uint8_t* buffer, size_t len, float* out_boxes, int32_t max_boxes);
        _LIB.neural_detect_faces.argtypes = [
            ctypes.POINTER(ctypes.c_uint8),
            ctypes.c_size_t,
            ctypes.POINTER(ctypes.c_float),
            ctypes.c_int32,
        ]
        _LIB.neural_detect_faces.restype = ctypes.c_int32

        # int32_t neural_detect_animals(const uint8_t* buffer, size_t len, float* out_boxes, char* out_labels, int32_t max_boxes);
        _LIB.neural_detect_animals.argtypes = [
            ctypes.POINTER(ctypes.c_uint8),
            ctypes.c_size_t,
            ctypes.POINTER(ctypes.c_float),
            ctypes.c_char_p,
            ctypes.c_int32,
        ]
        _LIB.neural_detect_animals.restype = ctypes.c_int32

        # int32_t neural_extract_ocr(const uint8_t* buffer, size_t len, char* out_text, size_t max_len);
        _LIB.neural_extract_ocr.argtypes = [
            ctypes.POINTER(ctypes.c_uint8),
            ctypes.c_size_t,
            ctypes.c_char_p,
            ctypes.c_size_t,
        ]
        _LIB.neural_extract_ocr.restype = ctypes.c_int32

        # int32_t neural_embed_image(const uint8_t* buffer, size_t len, float* out_embedding768);
        _LIB.neural_embed_image.argtypes = [
            ctypes.POINTER(ctypes.c_uint8),
            ctypes.c_size_t,
            ctypes.POINTER(ctypes.c_float),
        ]
        _LIB.neural_embed_image.restype = ctypes.c_int32

        # int32_t neural_embed_text(const char* query, float* out_embedding768);
        _LIB.neural_embed_text.argtypes = [
            ctypes.c_char_p,
            ctypes.POINTER(ctypes.c_float),
        ]
        _LIB.neural_embed_text.restype = ctypes.c_int32

        # bool neural_check_biometrics_available(void);
        _LIB.neural_check_biometrics_available.argtypes = []
        _LIB.neural_check_biometrics_available.restype = ctypes.c_bool

        # bool neural_evaluate_touch_id(const char* prompt);
        _LIB.neural_evaluate_touch_id.argtypes = [ctypes.c_char_p]
        _LIB.neural_evaluate_touch_id.restype = ctypes.c_bool

    except Exception:
        _LIB = None


def is_native_available() -> bool:
    """Return True if the native Swift bridge dylib is compiled and loaded."""
    return _LIB is not None


def detect_faces(data: bytes, max_boxes: int = 64) -> list[dict]:
    """Detect human faces in image bytes using Apple Vision via native Swift bridge."""
    if not is_native_available() or not data:
        return []

    raw_buf = (ctypes.c_uint8 * len(data)).from_buffer_copy(data)
    out_boxes = (ctypes.c_float * (max_boxes * 5))()

    count = _LIB.neural_detect_faces(raw_buf, len(data), out_boxes, max_boxes)
    if count <= 0:
        return []

    results = []
    for i in range(count):
        offset = i * 5
        results.append({
            "x": float(out_boxes[offset + 0]),
            "y": float(out_boxes[offset + 1]),
            "w": float(out_boxes[offset + 2]),
            "h": float(out_boxes[offset + 3]),
            "confidence": float(out_boxes[offset + 4]),
        })
    return results


def detect_animals(data: bytes, max_boxes: int = 64) -> list[dict]:
    """Detect pets (dogs, cats) in image bytes using Apple Vision via native Swift bridge."""
    if not is_native_available() or not data:
        return []

    raw_buf = (ctypes.c_uint8 * len(data)).from_buffer_copy(data)
    out_boxes = (ctypes.c_float * (max_boxes * 5))()
    out_labels = ctypes.create_string_buffer(max_boxes * 32)

    count = _LIB.neural_detect_animals(raw_buf, len(data), out_boxes, out_labels, max_boxes)
    if count <= 0:
        return []

    results = []
    for i in range(count):
        box_offset = i * 5
        label_offset = i * 32
        label_bytes = out_labels.raw[label_offset : label_offset + 32].split(b"\x00")[0]
        results.append({
            "x": float(out_boxes[box_offset + 0]),
            "y": float(out_boxes[box_offset + 1]),
            "w": float(out_boxes[box_offset + 2]),
            "h": float(out_boxes[box_offset + 3]),
            "confidence": float(out_boxes[box_offset + 4]),
            "label": label_bytes.decode("utf-8", errors="ignore") or "pet",
        })
    return results


def extract_ocr(data: bytes, max_len: int = 8192) -> str:
    """Extract OCR text from image bytes via Apple Vision VNRecognizeTextRequest."""
    if not is_native_available() or not data:
        return ""

    raw_buf = (ctypes.c_uint8 * len(data)).from_buffer_copy(data)
    out_text = ctypes.create_string_buffer(max_len)

    written = _LIB.neural_extract_ocr(raw_buf, len(data), out_text, max_len)
    if written <= 0:
        return ""
    return out_text.value.decode("utf-8", errors="ignore")


def embed_image(data: bytes) -> list[float] | None:
    """Generate 768-dimensional normalized unit embedding from image bytes."""
    if not is_native_available() or not data:
        return None

    raw_buf = (ctypes.c_uint8 * len(data)).from_buffer_copy(data)
    out_vec = (ctypes.c_float * 768)()

    status = _LIB.neural_embed_image(raw_buf, len(data), out_vec)
    if status != 0:
        return None
    return [float(x) for x in out_vec]


def embed_text(query: str) -> list[float] | None:
    """Generate 768-dimensional normalized unit embedding from text query."""
    if not is_native_available() or not query.strip():
        return None

    c_query = query.encode("utf-8")
    out_vec = (ctypes.c_float * 768)()

    status = _LIB.neural_embed_text(c_query, out_vec)
    if status != 0:
        return None
    return [float(x) for x in out_vec]


def check_biometrics_available() -> bool:
    """Check if Touch ID hardware is available."""
    if not is_native_available():
        return False
    return bool(_LIB.neural_check_biometrics_available())


def evaluate_touch_id(prompt: str = "Unlock Neural Gallery Vault") -> bool:
    """Evaluate Touch ID biometric authentication."""
    if not is_native_available():
        return False
    return bool(_LIB.neural_evaluate_touch_id(prompt.encode("utf-8")))
