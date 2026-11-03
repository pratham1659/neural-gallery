use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce as GcmNonce};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use hkdf::Hkdf;
use rand::RngCore;
use sha2::Sha256;
use std::io::{Read, Write};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum EvfsError {
    #[error("I/O error during EVFS operation: {0}")]
    Io(#[from] std::io::Error),
    #[error("Invalid EVFS container magic or version")]
    InvalidContainer,
    #[error("Unsupported cipher suite: {0}")]
    UnsupportedCipher(u8),
    #[error("Authentication failed: data has been tampered with or corrupted")]
    AuthenticationFailed,
    #[error("Chunk sequence error: expected index {expected}, found {actual}")]
    ChunkSequenceError { expected: u32, actual: u32 },
    #[error("Key derivation error: {0}")]
    KeyDerivation(String),
}

pub const EVFS_MAGIC: &[u8; 4] = b"AEV2";
pub const EVFS_VERSION: u8 = 2;
pub const CIPHER_AES_256_GCM: u8 = 1;
pub const CIPHER_XCHACHA20_POLY1305: u8 = 2;
pub const DEFAULT_CHUNK_SIZE: u32 = 64 * 1024; // 64 KiB

/// Derive a 256-bit asset-specific key from the Vault Master Key and an asset UUID.
pub fn derive_asset_key(master_key: &[u8; 32], asset_uuid: &str) -> Result<[u8; 32], EvfsError> {
    let hk = Hkdf::<Sha256>::new(None, master_key);
    let mut okm = [0u8; 32];
    let info = format!("aperture-asset-v1:{}", asset_uuid);
    hk.expand(info.as_bytes(), &mut okm)
        .map_err(|e| EvfsError::KeyDerivation(e.to_string()))?;
    Ok(okm)
}

/// Encrypt an input byte slice into an authenticated EVFS container using AES-256-GCM.
pub fn encrypt_bytes(data: &[u8], key: &[u8; 32], asset_uuid: &str) -> Result<Vec<u8>, EvfsError> {
    let mut output = Vec::with_capacity(data.len() + 256);
    let asset_key = derive_asset_key(key, asset_uuid)?;
    encrypt_stream_internal(
        &mut &data[..],
        &mut output,
        &asset_key,
        CIPHER_AES_256_GCM,
        DEFAULT_CHUNK_SIZE,
        data.len() as u64,
    )?;
    Ok(output)
}

/// Decrypt an authenticated EVFS container byte slice back to plaintext.
pub fn decrypt_bytes(container: &[u8], key: &[u8; 32], asset_uuid: &str) -> Result<Vec<u8>, EvfsError> {
    let mut output = Vec::new();
    let asset_key = derive_asset_key(key, asset_uuid)?;
    decrypt_stream_internal(&mut &container[..], &mut output, &asset_key)?;
    Ok(output)
}

/// Encrypt an input byte slice into an EVFS container using XChaCha20-Poly1305.
pub fn encrypt_bytes_xchacha(data: &[u8], key: &[u8; 32], asset_uuid: &str) -> Result<Vec<u8>, EvfsError> {
    let mut output = Vec::with_capacity(data.len() + 256);
    let asset_key = derive_asset_key(key, asset_uuid)?;
    encrypt_stream_internal(
        &mut &data[..],
        &mut output,
        &asset_key,
        CIPHER_XCHACHA20_POLY1305,
        DEFAULT_CHUNK_SIZE,
        data.len() as u64,
    )?;
    Ok(output)
}

fn encrypt_stream_internal<R: Read, W: Write>(
    reader: &mut R,
    writer: &mut W,
    key: &[u8; 32],
    cipher_type: u8,
    chunk_size: u32,
    total_len: u64,
) -> Result<(), EvfsError> {
    // Generate 12-byte random base nonce for GCM or 24-byte for XChaCha
    let mut base_nonce = [0u8; 24];
    rand::rngs::OsRng.fill_bytes(&mut base_nonce);

    // Write Header:
    // Magic (4B) + Version (1B) + Cipher (1B) + ChunkSize (4B) + TotalLen (8B) + BaseNonce (24B)
    writer.write_all(EVFS_MAGIC)?;
    writer.write_all(&[EVFS_VERSION, cipher_type])?;
    writer.write_all(&chunk_size.to_le_bytes())?;
    writer.write_all(&total_len.to_le_bytes())?;
    writer.write_all(&base_nonce)?;

    let mut chunk_index = 0u32;
    let mut buffer = vec![0u8; chunk_size as usize];

    loop {
        let bytes_read = reader.read(&mut buffer)?;
        if bytes_read == 0 && chunk_index > 0 {
            break;
        }

        let chunk_slice = &buffer[..bytes_read];

        // Derive chunk nonce by combining base nonce with monotonic chunk counter
        let ciphertext = match cipher_type {
            CIPHER_AES_256_GCM => {
                let cipher = Aes256Gcm::new_from_slice(key)
                    .map_err(|_| EvfsError::AuthenticationFailed)?;
                let mut chunk_nonce = [0u8; 12];
                chunk_nonce.copy_from_slice(&base_nonce[0..12]);
                let counter_bytes = chunk_index.to_be_bytes();
                for i in 0..4 {
                    chunk_nonce[8 + i] ^= counter_bytes[i];
                }
                let nonce = GcmNonce::from_slice(&chunk_nonce);
                cipher
                    .encrypt(nonce, chunk_slice)
                    .map_err(|_| EvfsError::AuthenticationFailed)?
            }
            CIPHER_XCHACHA20_POLY1305 => {
                let cipher = XChaCha20Poly1305::new_from_slice(key)
                    .map_err(|_| EvfsError::AuthenticationFailed)?;
                let mut chunk_nonce = base_nonce;
                let counter_bytes = chunk_index.to_be_bytes();
                for i in 0..4 {
                    chunk_nonce[20 + i] ^= counter_bytes[i];
                }
                let nonce = XNonce::from_slice(&chunk_nonce);
                cipher
                    .encrypt(nonce, chunk_slice)
                    .map_err(|_| EvfsError::AuthenticationFailed)?
            }
            other => return Err(EvfsError::UnsupportedCipher(other)),
        };

        // Write Chunk Header: Chunk Index (4B) + Ciphertext Length (4B) + Ciphertext Payload
        writer.write_all(&chunk_index.to_le_bytes())?;
        writer.write_all(&(ciphertext.len() as u32).to_le_bytes())?;
        writer.write_all(&ciphertext)?;

        chunk_index += 1;

        if bytes_read < chunk_size as usize {
            break;
        }
    }

    writer.flush()?;
    Ok(())
}

fn decrypt_stream_internal<R: Read, W: Write>(
    reader: &mut R,
    writer: &mut W,
    key: &[u8; 32],
) -> Result<(), EvfsError> {
    let mut header = [0u8; 4 + 2 + 4 + 8 + 24];
    reader.read_exact(&mut header)?;

    if &header[0..4] != EVFS_MAGIC || header[4] != EVFS_VERSION {
        return Err(EvfsError::InvalidContainer);
    }

    let cipher_type = header[5];
    let chunk_size = u32::from_le_bytes(header[6..10].try_into().unwrap());
    let _total_len = u64::from_le_bytes(header[10..18].try_into().unwrap());
    let base_nonce = &header[18..42];

    let mut expected_chunk = 0u32;

    loop {
        let mut chunk_hdr = [0u8; 8];
        match reader.read_exact(&mut chunk_hdr) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => {
                break;
            }
            Err(e) => return Err(EvfsError::Io(e)),
        }

        let chunk_index = u32::from_le_bytes(chunk_hdr[0..4].try_into().unwrap());
        let chunk_len = u32::from_le_bytes(chunk_hdr[4..8].try_into().unwrap()) as usize;

        if chunk_index != expected_chunk {
            return Err(EvfsError::ChunkSequenceError {
                expected: expected_chunk,
                actual: chunk_index,
            });
        }

        let mut cipher_buf = vec![0u8; chunk_len];
        reader.read_exact(&mut cipher_buf)?;

        let plaintext = match cipher_type {
            CIPHER_AES_256_GCM => {
                let cipher = Aes256Gcm::new_from_slice(key)
                    .map_err(|_| EvfsError::AuthenticationFailed)?;
                let mut chunk_nonce = [0u8; 12];
                chunk_nonce.copy_from_slice(&base_nonce[0..12]);
                let counter_bytes = chunk_index.to_be_bytes();
                for i in 0..4 {
                    chunk_nonce[8 + i] ^= counter_bytes[i];
                }
                let nonce = GcmNonce::from_slice(&chunk_nonce);
                cipher
                    .decrypt(nonce, cipher_buf.as_slice())
                    .map_err(|_| EvfsError::AuthenticationFailed)?
            }
            CIPHER_XCHACHA20_POLY1305 => {
                let cipher = XChaCha20Poly1305::new_from_slice(key)
                    .map_err(|_| EvfsError::AuthenticationFailed)?;
                let mut chunk_nonce = [0u8; 24];
                chunk_nonce.copy_from_slice(base_nonce);
                let counter_bytes = chunk_index.to_be_bytes();
                for i in 0..4 {
                    chunk_nonce[20 + i] ^= counter_bytes[i];
                }
                let nonce = XNonce::from_slice(&chunk_nonce);
                cipher
                    .decrypt(nonce, cipher_buf.as_slice())
                    .map_err(|_| EvfsError::AuthenticationFailed)?
            }
            other => return Err(EvfsError::UnsupportedCipher(other)),
        };

        writer.write_all(&plaintext)?;
        expected_chunk += 1;

        if plaintext.len() < chunk_size as usize {
            break;
        }
    }

    writer.flush()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_evfs_aes_gcm_roundtrip() {
        let master_key = [0x42u8; 32];
        let asset_id = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
        let original_data = b"Neural Gallery Zero-Knowledge Photo Asset Payload bytes here!";

        let encrypted = encrypt_bytes(original_data, &master_key, asset_id).unwrap();
        assert_ne!(&encrypted, original_data);
        assert_eq!(&encrypted[0..4], EVFS_MAGIC);

        let decrypted = decrypt_bytes(&encrypted, &master_key, asset_id).unwrap();
        assert_eq!(decrypted, original_data);
    }

    #[test]
    fn test_evfs_xchacha_roundtrip() {
        let master_key = [0x99u8; 32];
        let asset_id = "video-stream-large-chunked-asset-id";
        let mut original_data = vec![0u8; 128 * 1024]; // 128 KiB
        for (i, b) in original_data.iter_mut().enumerate() {
            *b = (i % 251) as u8;
        }

        let encrypted = encrypt_bytes_xchacha(&original_data, &master_key, asset_id).unwrap();
        let decrypted = decrypt_bytes(&encrypted, &master_key, asset_id).unwrap();
        assert_eq!(decrypted, original_data);
    }

    #[test]
    fn test_evfs_tamper_detection() {
        let master_key = [0x77u8; 32];
        let asset_id = "tamper-proof-asset-id";
        let original_data = b"Sensitive unencrypted photo payload";

        let mut encrypted = encrypt_bytes(original_data, &master_key, asset_id).unwrap();

        // Flip a byte in the ciphertext payload
        let len = encrypted.len();
        encrypted[len - 5] ^= 0xFF;

        let result = decrypt_bytes(&encrypted, &master_key, asset_id);
        assert!(result.is_err());
        match result.unwrap_err() {
            EvfsError::AuthenticationFailed => {}
            other => panic!("Expected AuthenticationFailed, got {:?}", other),
        }
    }

    #[test]
    fn test_evfs_wrong_asset_key_fails() {
        let master_key = [0x11u8; 32];
        let asset_id = "asset-1";
        let original_data = b"Payload with unique asset key derivation";

        let encrypted = encrypt_bytes(original_data, &master_key, asset_id).unwrap();
        let result = decrypt_bytes(&encrypted, &master_key, "different-asset-id");
        assert!(result.is_err());
    }
}
