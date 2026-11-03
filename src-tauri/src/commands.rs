use crate::bridge::swift::{
    check_biometrics_available, detect_animals, detect_faces, embed_text, evaluate_touch_id,
    extract_ocr, AnimalBox, FaceBox,
};
use crate::state::{VaultManager, VaultStatus};
use std::fs;
use std::path::Path;
use tauri::State;

#[tauri::command]
pub fn vault_status(
    state: State<'_, VaultManager>,
    directory: Option<String>,
) -> Result<VaultStatus, String> {
    let dir = directory.as_ref().map(|s| Path::new(s.as_str()));
    Ok(state.status(dir))
}

#[tauri::command]
pub fn vault_init(
    passphrase: String,
    vault_dir: String,
    state: State<'_, VaultManager>,
) -> Result<VaultStatus, String> {
    state
        .init_vault(&passphrase, Path::new(&vault_dir))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn vault_unlock(
    passphrase: String,
    vault_dir: String,
    state: State<'_, VaultManager>,
) -> Result<VaultStatus, String> {
    state
        .unlock_vault(&passphrase, Path::new(&vault_dir))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn vault_lock(state: State<'_, VaultManager>) -> Result<VaultStatus, String> {
    Ok(state.lock_vault())
}

#[tauri::command]
pub fn vault_encrypt_file(
    input_path: String,
    output_path: String,
    state: State<'_, VaultManager>,
) -> Result<String, String> {
    state
        .encrypt_file(Path::new(&input_path), Path::new(&output_path))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn vault_decrypt_file(
    input_path: String,
    output_path: String,
    asset_id: String,
    state: State<'_, VaultManager>,
) -> Result<(), String> {
    state
        .decrypt_file(Path::new(&input_path), Path::new(&output_path), &asset_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn vault_auth_touch_id(reason: Option<String>) -> Result<bool, String> {
    let prompt = reason.unwrap_or_else(|| "Unlock Neural Gallery Vault".to_string());
    Ok(evaluate_touch_id(&prompt))
}

#[tauri::command]
pub fn vault_check_biometrics() -> Result<bool, String> {
    Ok(check_biometrics_available())
}

#[tauri::command]
pub fn vault_detect_faces(image_path: String) -> Result<Vec<FaceBox>, String> {
    let bytes = fs::read(&image_path).map_err(|e| e.to_string())?;
    Ok(detect_faces(&bytes))
}

#[tauri::command]
pub fn vault_detect_animals(image_path: String) -> Result<Vec<AnimalBox>, String> {
    let bytes = fs::read(&image_path).map_err(|e| e.to_string())?;
    Ok(detect_animals(&bytes))
}

#[tauri::command]
pub fn vault_extract_ocr(image_path: String) -> Result<String, String> {
    let bytes = fs::read(&image_path).map_err(|e| e.to_string())?;
    Ok(extract_ocr(&bytes))
}

#[tauri::command]
pub fn vault_embed_text(query: String) -> Result<Vec<f32>, String> {
    embed_text(&query)
        .map(|arr| arr.to_vec())
        .ok_or_else(|| "Failed to generate text embedding".to_string())
}
