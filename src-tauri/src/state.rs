use crate::crypto::evfs::{self, EvfsError};
use crate::crypto::kdf::{derive_kek, generate_salt, KdfError, SALT_LENGTH};
use crate::crypto::memguard::SecureKey;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use thiserror::Error;
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum VaultError {
    #[error("Vault is not unlocked")]
    Locked,
    #[error("Vault is already initialized")]
    AlreadyInitialized,
    #[error("Vault is not initialized")]
    NotInitialized,
    #[error("Invalid passphrase")]
    InvalidPassphrase,
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("KDF error: {0}")]
    Kdf(#[from] KdfError),
    #[error("EVFS error: {0}")]
    Evfs(#[from] EvfsError),
}

const VAULT_META_FILE: &str = "vault.meta";
const VAULT_META_MAGIC: &[u8; 15] = b"NEURAL_VAULT_V1";
const VERIFY_TOKEN: &[u8; 32] = b"VERIFIED_VAULT_MASTER_KEY_TOKEN!";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultStatus {
    pub is_initialized: bool,
    pub is_unlocked: bool,
    pub vault_dir: Option<String>,
}

pub struct VaultManager {
    inner: Arc<Mutex<VaultState>>,
}

struct VaultState {
    is_initialized: bool,
    is_unlocked: bool,
    master_key: Option<SecureKey>,
    salt: Option<[u8; SALT_LENGTH]>,
    vault_dir: Option<PathBuf>,
}

impl VaultManager {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(VaultState {
                is_initialized: false,
                is_unlocked: false,
                master_key: None,
                salt: None,
                vault_dir: None,
            })),
        }
    }

    /// Check the vault status for the given or configured directory.
    pub fn status(&self, directory: Option<&Path>) -> VaultStatus {
        let mut state = self.inner.lock().unwrap();

        if let Some(dir) = directory {
            let meta_path = dir.join(VAULT_META_FILE);
            let exists = meta_path.exists();
            state.is_initialized = exists;
            state.vault_dir = Some(dir.to_path_buf());
        }

        VaultStatus {
            is_initialized: state.is_initialized,
            is_unlocked: state.is_unlocked,
            vault_dir: state.vault_dir.as_ref().map(|p| p.to_string_lossy().to_string()),
        }
    }

    /// Initialize a new cryptographic vault in the target directory with a master passphrase.
    pub fn init_vault(&self, passphrase: &str, vault_dir: &Path) -> Result<VaultStatus, VaultError> {
        let mut state = self.inner.lock().unwrap();

        fs::create_dir_all(vault_dir)?;
        let meta_path = vault_dir.join(VAULT_META_FILE);
        if meta_path.exists() {
            return Err(VaultError::AlreadyInitialized);
        }

        let salt = generate_salt();
        let kek = derive_kek(passphrase, &salt)?;

        // Encrypt the known verification token using the derived KEK
        let verification_container = evfs::encrypt_bytes(VERIFY_TOKEN, kek.as_bytes(), "vault-verification")?;

        let mut file = File::create(&meta_path)?;
        file.write_all(VAULT_META_MAGIC)?;
        file.write_all(&salt)?;
        file.write_all(&(verification_container.len() as u32).to_le_bytes())?;
        file.write_all(&verification_container)?;
        file.flush()?;

        state.is_initialized = true;
        state.is_unlocked = true;
        state.salt = Some(salt);
        state.master_key = Some(kek);
        state.vault_dir = Some(vault_dir.to_path_buf());

        Ok(VaultStatus {
            is_initialized: true,
            is_unlocked: true,
            vault_dir: Some(vault_dir.to_string_lossy().to_string()),
        })
    }

    /// Unlock an existing vault using the master passphrase.
    pub fn unlock_vault(&self, passphrase: &str, vault_dir: &Path) -> Result<VaultStatus, VaultError> {
        let mut state = self.inner.lock().unwrap();

        let meta_path = vault_dir.join(VAULT_META_FILE);
        if !meta_path.exists() {
            return Err(VaultError::NotInitialized);
        }

        let mut file = File::open(&meta_path)?;
        let mut magic = [0u8; 15];
        file.read_exact(&mut magic)?;
        if &magic != VAULT_META_MAGIC {
            return Err(VaultError::NotInitialized);
        }

        let mut salt = [0u8; SALT_LENGTH];
        file.read_exact(&mut salt)?;

        let mut container_len_bytes = [0u8; 4];
        file.read_exact(&mut container_len_bytes)?;
        let container_len = u32::from_le_bytes(container_len_bytes) as usize;

        let mut container = vec![0u8; container_len];
        file.read_exact(&mut container)?;

        // Derive KEK from entered passphrase
        let kek = derive_kek(passphrase, &salt)?;

        // Attempt to decrypt the verification token
        match evfs::decrypt_bytes(&container, kek.as_bytes(), "vault-verification") {
            Ok(decrypted) if decrypted == VERIFY_TOKEN => {
                // Passphrase is valid! Unlock vault.
                state.is_initialized = true;
                state.is_unlocked = true;
                state.salt = Some(salt);
                state.master_key = Some(kek);
                state.vault_dir = Some(vault_dir.to_path_buf());

                Ok(VaultStatus {
                    is_initialized: true,
                    is_unlocked: true,
                    vault_dir: Some(vault_dir.to_string_lossy().to_string()),
                })
            }
            _ => Err(VaultError::InvalidPassphrase),
        }
    }

    /// Instant panic lockdown: Drops key material, triggers `zeroize`, and returns to locked state in < 10ms.
    pub fn lock_vault(&self) -> VaultStatus {
        let mut state = self.inner.lock().unwrap();

        // Dropping `master_key` invokes `ZeroizeOnDrop` immediately
        let _old_key = state.master_key.take();
        state.is_unlocked = false;

        VaultStatus {
            is_initialized: state.is_initialized,
            is_unlocked: false,
            vault_dir: state.vault_dir.as_ref().map(|p| p.to_string_lossy().to_string()),
        }
    }

    /// Encrypt a file into an EVFS authenticated container.
    pub fn encrypt_file(&self, input_path: &Path, output_path: &Path) -> Result<String, VaultError> {
        let state = self.inner.lock().unwrap();
        if !state.is_unlocked || state.master_key.is_none() {
            return Err(VaultError::Locked);
        }

        let master_key = state.master_key.as_ref().unwrap();
        let asset_id = Uuid::new_v4().to_string();

        let data = fs::read(input_path)?;
        let encrypted = evfs::encrypt_bytes(&data, master_key.as_bytes(), &asset_id)?;

        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(output_path, &encrypted)?;

        Ok(asset_id)
    }

    /// Decrypt an EVFS container file back to plaintext.
    pub fn decrypt_file(&self, input_path: &Path, output_path: &Path, asset_id: &str) -> Result<(), VaultError> {
        let state = self.inner.lock().unwrap();
        if !state.is_unlocked || state.master_key.is_none() {
            return Err(VaultError::Locked);
        }

        let master_key = state.master_key.as_ref().unwrap();
        let encrypted = fs::read(input_path)?;
        let decrypted = evfs::decrypt_bytes(&encrypted, master_key.as_bytes(), asset_id)?;

        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(output_path, &decrypted)?;

        Ok(())
    }
}

impl Default for VaultManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_vault_init_unlock_lock_flow() {
        let dir = tempdir().unwrap();
        let vault_path = dir.path();

        let manager = VaultManager::new();
        assert!(!manager.status(Some(vault_path)).is_initialized);

        let status = manager.init_vault("ultra-secure-passphrase-42!", vault_path).unwrap();
        assert!(status.is_initialized);
        assert!(status.is_unlocked);

        // Lock vault
        let locked_status = manager.lock_vault();
        assert!(!locked_status.is_unlocked);

        // Try unlocking with wrong passphrase
        let fail = manager.unlock_vault("wrong-pass", vault_path);
        assert!(fail.is_err());
        assert!(!manager.status(None).is_unlocked);

        // Unlock with correct passphrase
        let unlocked = manager.unlock_vault("ultra-secure-passphrase-42!", vault_path).unwrap();
        assert!(unlocked.is_unlocked);

        // Encrypt and decrypt file roundtrip
        let plain_file = vault_path.join("sample.txt");
        let enc_file = vault_path.join("sample.aev");
        let dec_file = vault_path.join("sample_dec.txt");

        fs::write(&plain_file, b"Zero-knowledge photo bytes").unwrap();

        let asset_id = manager.encrypt_file(&plain_file, &enc_file).unwrap();
        assert!(enc_file.exists());

        manager.decrypt_file(&enc_file, &dec_file, &asset_id).unwrap();
        assert_eq!(fs::read(&dec_file).unwrap(), b"Zero-knowledge photo bytes");
    }
}
