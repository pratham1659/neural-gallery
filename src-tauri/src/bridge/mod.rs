pub mod swift;

pub use swift::{
    check_biometrics_available, detect_animals, detect_faces, embed_image, embed_text,
    evaluate_touch_id, extract_ocr, AnimalBox, FaceBox,
};
