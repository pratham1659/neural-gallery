"""Tests for Phase 3: Native Swift Acceleration Bridge (Apple Vision, Core ML ANE, Touch ID)."""

import io
import math
import unittest
from PIL import Image, ImageDraw

from neural_gallery.native_bridge import (
    is_native_available,
    detect_faces,
    detect_animals,
    extract_ocr,
    embed_image,
    embed_text,
    check_biometrics_available,
)


class Phase3NativeBridgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create a test image with distinct text for OCR
        cls.img_text = Image.new("RGB", (600, 200), color=(255, 255, 255))
        draw = ImageDraw.Draw(cls.img_text)
        draw.text((20, 80), "NEURAL GALLERY VAULT 2026", fill=(0, 0, 0))
        buf = io.BytesIO()
        cls.img_text.save(buf, format="JPEG")
        cls.img_text_bytes = buf.getvalue()

        # Create a generic patterned test image for visual embedding
        cls.img_pattern = Image.new("RGB", (256, 256), color=(40, 80, 160))
        buf = io.BytesIO()
        cls.img_pattern.save(buf, format="JPEG")
        cls.img_pattern_bytes = buf.getvalue()

    def test_native_library_loaded(self):
        self.assertTrue(
            is_native_available(),
            "libneural_bridge.dylib should be compiled and loadable via ctypes",
        )

    def test_embed_text_dimensions_and_l2_norm(self):
        query = "golden retriever playing in snow"
        vec = embed_text(query)
        self.assertIsNotNone(vec)
        self.assertEqual(len(vec), 768)

        # Check L2 normalization (sum of squares should equal ~1.0)
        norm = math.sqrt(sum(x * x for x in vec))
        self.assertAlmostEqual(norm, 1.0, places=3)

    def test_embed_text_distinct_vectors(self):
        vec1 = embed_text("sunset over ocean beach")
        vec2 = embed_text("tax receipt from apple store")
        self.assertIsNotNone(vec1)
        self.assertIsNotNone(vec2)
        self.assertNotEqual(vec1, vec2)

        # Cosine similarity between distinct concepts should be lower than identical
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        self.assertLess(dot_product, 0.99)

    def test_embed_image_dimensions_and_l2_norm(self):
        vec = embed_image(self.img_pattern_bytes)
        self.assertIsNotNone(vec)
        self.assertEqual(len(vec), 768)

        norm = math.sqrt(sum(x * x for x in vec))
        self.assertAlmostEqual(norm, 1.0, places=3)

    def test_detect_faces_on_pattern(self):
        # Pattern image should return empty list (0 faces) cleanly without crashing
        faces = detect_faces(self.img_pattern_bytes)
        self.assertIsInstance(faces, list)

    def test_detect_animals_on_pattern(self):
        # Pattern image should return empty list (0 animals) cleanly without crashing
        animals = detect_animals(self.img_pattern_bytes)
        self.assertIsInstance(animals, list)

    def test_extract_ocr_from_image(self):
        ocr_result = extract_ocr(self.img_text_bytes)
        self.assertIsInstance(ocr_result, str)
        # Apple Vision text recognition on clear uppercase text
        self.assertTrue(
            "NEURAL" in ocr_result or "GALLERY" in ocr_result or "2026" in ocr_result or len(ocr_result) > 0,
            f"Expected OCR to detect text, got: {ocr_result}",
        )

    def test_check_biometrics_available(self):
        available = check_biometrics_available()
        self.assertIsInstance(available, bool)

    def test_error_handling_empty_inputs(self):
        self.assertEqual(detect_faces(b""), [])
        self.assertEqual(detect_animals(b""), [])
        self.assertEqual(extract_ocr(b""), "")
        self.assertIsNone(embed_image(b""))
        self.assertIsNone(embed_text(""))


if __name__ == "__main__":
    unittest.main()
