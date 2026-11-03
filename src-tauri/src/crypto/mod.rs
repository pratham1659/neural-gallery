pub mod evfs;
pub mod kdf;
pub mod memguard;

pub use evfs::{decrypt_bytes, encrypt_bytes, encrypt_bytes_xchacha, derive_asset_key, EvfsError};
pub use kdf::{derive_kek, generate_salt, KdfError, KEY_LENGTH, SALT_LENGTH};
pub use memguard::{ProtectedBuffer, SecureKey};
