use serde::{Deserialize, Serialize};
use std::ffi::CString;

extern "C" {
    fn neural_detect_faces(
        image_bytes: *const u8,
        length: usize,
        out_boxes: *mut f32,
        max_faces: i32,
    ) -> i32;

    fn neural_detect_animals(
        image_bytes: *const u8,
        length: usize,
        out_boxes: *mut f32,
        out_labels: *mut libc::c_char,
        max_animals: i32,
    ) -> i32;

    fn neural_extract_ocr(
        image_bytes: *const u8,
        length: usize,
        out_text: *mut libc::c_char,
        max_text_len: usize,
    ) -> i32;

    fn neural_embed_image(
        image_bytes: *const u8,
        length: usize,
        out_embedding_768: *mut f32,
    ) -> i32;

    fn neural_embed_text(
        text: *const libc::c_char,
        out_embedding_768: *mut f32,
    ) -> i32;

    fn neural_check_biometrics_available() -> i32;

    fn neural_evaluate_touch_id(reason: *const libc::c_char) -> i32;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FaceBox {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimalBox {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
    pub label: String,
    pub confidence: f32,
}

/// Detect faces using Apple Vision VNDetectFaceRectanglesRequest via native bridge.
pub fn detect_faces(image_bytes: &[u8]) -> Vec<FaceBox> {
    const MAX_FACES: usize = 32;
    let mut out_boxes = vec![0.0f32; MAX_FACES * 5];

    let count = unsafe {
        neural_detect_faces(
            image_bytes.as_ptr(),
            image_bytes.len(),
            out_boxes.as_mut_ptr(),
            MAX_FACES as i32,
        )
    };

    if count <= 0 {
        return Vec::new();
    }

    let mut results = Vec::with_capacity(count as usize);
    for i in 0..(count as usize) {
        let base = i * 5;
        results.push(FaceBox {
            x: out_boxes[base],
            y: out_boxes[base + 1],
            w: out_boxes[base + 2],
            h: out_boxes[base + 3],
            confidence: out_boxes[base + 4],
        });
    }

    results
}

/// Detect pets (dogs and cats) using Apple Vision VNRecognizeAnimalsRequest.
pub fn detect_animals(image_bytes: &[u8]) -> Vec<AnimalBox> {
    const MAX_ANIMALS: usize = 16;
    let mut out_boxes = vec![0.0f32; MAX_ANIMALS * 5];
    let mut out_labels = vec![0u8; MAX_ANIMALS * 32];

    let count = unsafe {
        neural_detect_animals(
            image_bytes.as_ptr(),
            image_bytes.len(),
            out_boxes.as_mut_ptr(),
            out_labels.as_mut_ptr() as *mut libc::c_char,
            MAX_ANIMALS as i32,
        )
    };

    if count <= 0 {
        return Vec::new();
    }

    let mut results = Vec::with_capacity(count as usize);
    for i in 0..(count as usize) {
        let box_base = i * 5;
        let label_base = i * 32;

        let label_slice = &out_labels[label_base..label_base + 32];
        let label_len = label_slice.iter().position(|&c| c == 0).unwrap_or(32);
        let label = String::from_utf8_lossy(&label_slice[..label_len]).to_string();

        results.push(AnimalBox {
            x: out_boxes[box_base],
            y: out_boxes[box_base + 1],
            w: out_boxes[box_base + 2],
            h: out_boxes[box_base + 3],
            label,
            confidence: out_boxes[box_base + 4],
        });
    }

    results
}

/// Extract text using Apple Vision VNRecognizeTextRequest (.accurate).
pub fn extract_ocr(image_bytes: &[u8]) -> String {
    let mut buffer = vec![0u8; 16384]; // 16 KiB text buffer

    let len = unsafe {
        neural_extract_ocr(
            image_bytes.as_ptr(),
            image_bytes.len(),
            buffer.as_mut_ptr() as *mut libc::c_char,
            buffer.len(),
        )
    };

    if len <= 0 {
        return String::new();
    }

    let valid_len = (len as usize).min(buffer.len());
    String::from_utf8_lossy(&buffer[..valid_len]).to_string()
}

/// Generate 768-dimensional normalized L2 vector embedding for an image.
pub fn embed_image(image_bytes: &[u8]) -> Option<[f32; 768]> {
    let mut embedding = [0.0f32; 768];
    let res = unsafe {
        neural_embed_image(
            image_bytes.as_ptr(),
            image_bytes.len(),
            embedding.as_mut_ptr(),
        )
    };

    if res == 0 {
        Some(embedding)
    } else {
        None
    }
}

/// Generate 768-dimensional normalized L2 vector embedding for a text query.
pub fn embed_text(query: &str) -> Option<[f32; 768]> {
    let c_text = CString::new(query).ok()?;
    let mut embedding = [0.0f32; 768];

    let res = unsafe {
        neural_embed_text(c_text.as_ptr(), embedding.as_mut_ptr())
    };

    if res == 0 {
        Some(embedding)
    } else {
        None
    }
}

/// Check if Touch ID / biometric hardware is enrolled and available on this Mac.
pub fn check_biometrics_available() -> bool {
    unsafe { neural_check_biometrics_available() == 1 }
}

/// Evaluate Touch ID authentication with the provided prompt string.
pub fn evaluate_touch_id(reason: &str) -> bool {
    let c_reason = match CString::new(reason) {
        Ok(s) => s,
        Err(_) => return false,
    };

    unsafe { neural_evaluate_touch_id(c_reason.as_ptr()) == 1 }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_biometrics_check_runs_safely() {
        // Safe check whether biometrics is available or not
        let _available = check_biometrics_available();
    }

    #[test]
    fn test_text_embedding_unit_norm() {
        let embedding = embed_text("mountain hike at sunset");
        assert!(embedding.is_some());
        let vec = embedding.unwrap();
        assert_eq!(vec.len(), 768);

        // Compute L2 norm: sqrt(sum(v_i^2))
        let norm: f32 = vec.iter().map(|&x| x * x).sum::<f32>().sqrt();
        assert!((norm - 1.0).abs() < 1e-3, "L2 norm should be unit: {}", norm);
    }
}
