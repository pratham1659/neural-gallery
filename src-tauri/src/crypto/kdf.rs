use crate::crypto::memguard::SecureKey;
use argon2::{Algorithm, Argon2, Params, Version};
use rand::RngCore;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum KdfError {
    #[error("Argon2 parameter error: {0}")]
    ParamError(String),
    #[error("Argon2 derivation error: {0}")]
    DerivationError(String),
}

/// Standard production parameters according to TRD Section 3.1:
/// Memory cost: 65,536 KiB (64 MiB)
/// Time cost: 3 iterations
/// Parallelism: 4 threads
pub const PRODUCTION_MEMORY_KIB: u32 = 65_536;
pub const PRODUCTION_ITERATIONS: u32 = 3;
pub const PRODUCTION_PARALLELISM: u32 = 4;
pub const KEY_LENGTH: usize = 32;
pub const SALT_LENGTH: usize = 32;

/// Generate a cryptographically secure 32-byte salt using OsRng.
pub fn generate_salt() -> [u8; SALT_LENGTH] {
    let mut salt = [0u8; SALT_LENGTH];
    rand::rngs::OsRng.fill_bytes(&mut salt);
    salt
}

/// Derive a 256-bit Key Encryption Key (KEK) using Argon2id with production parameters.
pub fn derive_kek(passphrase: &str, salt: &[u8; SALT_LENGTH]) -> Result<SecureKey, KdfError> {
    derive_kek_custom(
        passphrase,
        salt,
        PRODUCTION_MEMORY_KIB,
        PRODUCTION_ITERATIONS,
        PRODUCTION_PARALLELISM,
    )
}

/// Derive a 256-bit Key Encryption Key (KEK) using Argon2id with specified parameters.
pub fn derive_kek_custom(
    passphrase: &str,
    salt: &[u8; SALT_LENGTH],
    memory_kib: u32,
    iterations: u32,
    parallelism: u32,
) -> Result<SecureKey, KdfError> {
    let params = Params::new(memory_kib, iterations, parallelism, Some(KEY_LENGTH))
        .map_err(|e| KdfError::ParamError(e.to_string()))?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut key_bytes = [0u8; KEY_LENGTH];
    argon2
        .hash_password_into(passphrase.as_bytes(), salt, &mut key_bytes)
        .map_err(|e| KdfError::DerivationError(e.to_string()))?;

    Ok(SecureKey::from_bytes(key_bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_salt_generation_uniqueness() {
        let salt1 = generate_salt();
        let salt2 = generate_salt();
        assert_ne!(salt1, salt2);
    }

    #[test]
    fn test_argon2id_derivation_deterministic() {
        let salt = [0x55u8; 32];
        let passphrase = "correct-horse-battery-staple";

        // Use lighter parameters for quick unit test execution
        let key1 = derive_kek_custom(passphrase, &salt, 1024, 1, 1).unwrap();
        let key2 = derive_kek_custom(passphrase, &salt, 1024, 1, 1).unwrap();

        assert_eq!(key1.as_bytes(), key2.as_bytes());

        let wrong_key = derive_kek_custom("wrong-password", &salt, 1024, 1, 1).unwrap();
        assert_ne!(key1.as_bytes(), wrong_key.as_bytes());
    }

    #[test]
    fn test_production_params_execution() {
        let salt = generate_salt();
        let key = derive_kek("vault-master-passphrase-test", &salt);
        assert!(key.is_ok());
        assert_eq!(key.unwrap().len(), 32);
    }
}
