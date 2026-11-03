pub mod bridge;
pub mod commands;
pub mod crypto;
pub mod lifecycle;
pub mod state;

use commands::*;
use state::VaultManager;

pub fn run() {
    lifecycle::setup_anti_forensics();

    tauri::Builder::default()
        .manage(VaultManager::new())
        .invoke_handler(tauri::generate_handler![
            vault_status,
            vault_init,
            vault_unlock,
            vault_lock,
            vault_encrypt_file,
            vault_decrypt_file,
            vault_auth_touch_id,
            vault_check_biometrics,
            vault_detect_faces,
            vault_detect_animals,
            vault_extract_ocr,
            vault_embed_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Neural Gallery application");
}
