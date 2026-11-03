#ifndef NEURAL_BRIDGE_H
#define NEURAL_BRIDGE_H

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Detect human faces in image bytes (JPEG, PNG, HEIC, TIFF).
 * Coordinates are normalized [0.0, 1.0] with bottom-left origin.
 * Writes 5 floats per face: [x, y, width, height, confidence] into out_boxes (size >= max_boxes * 5).
 * Returns number of detected faces, or negative on error.
 */
int32_t neural_detect_faces(const uint8_t* buffer, size_t len, float* out_boxes, int32_t max_boxes);

/**
 * Detect animals/pets (dogs, cats) in image bytes via Apple Vision.
 * Writes 5 floats per animal: [x, y, width, height, confidence] into out_boxes (size >= max_boxes * 5).
 * Writes 32 bytes per label into out_labels (size >= max_boxes * 32).
 * Returns number of detected animals, or negative on error.
 */
int32_t neural_detect_animals(const uint8_t* buffer, size_t len, float* out_boxes, char* out_labels, int32_t max_boxes);

/**
 * Perform Optical Character Recognition (OCR) on image bytes via VNRecognizeTextRequest.
 * Writes UTF-8 null-terminated extracted text into out_text.
 * Returns number of bytes written, or negative on error.
 */
int32_t neural_extract_ocr(const uint8_t* buffer, size_t len, char* out_text, size_t max_len);

/**
 * Generate 768-dimensional normalized L2 visual embedding (MobileCLIP-B).
 * Writes 768 float32 values into out_embedding768.
 * Returns 0 on success, negative on error.
 */
int32_t neural_embed_image(const uint8_t* buffer, size_t len, float* out_embedding768);

/**
 * Generate 768-dimensional normalized L2 text query embedding (MobileCLIP-B).
 * Writes 768 float32 values into out_embedding768.
 * Returns 0 on success, negative on error.
 */
int32_t neural_embed_text(const char* query, float* out_embedding768);

/**
 * Check if Touch ID / LocalAuthentication biometric hardware is available on this Mac.
 */
bool neural_check_biometrics_available(void);

/**
 * Evaluate Touch ID biometrics.
 * Returns true if authenticated, false otherwise.
 */
bool neural_evaluate_touch_id(const char* prompt);

#ifdef __cplusplus
}
#endif

#endif // NEURAL_BRIDGE_H
