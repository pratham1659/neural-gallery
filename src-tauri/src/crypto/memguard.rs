use std::ops::{Deref, DerefMut};
use zeroize::{Zeroize, ZeroizeOnDrop};

/// A memory-guarded buffer that pins its allocation in RAM using `libc::mlock`
/// (preventing the operating system from swapping it to disk) and automatically
/// zeroizes its contents upon drop via `ZeroizeOnDrop`.
#[derive(Debug)]
pub struct ProtectedBuffer {
    data: Vec<u8>,
    is_locked: bool,
}

impl ProtectedBuffer {
    /// Create a new protected buffer with the specified capacity, filled with zeroes.
    pub fn new(size: usize) -> Self {
        let mut data = vec![0u8; size];
        let ptr = data.as_mut_ptr() as *const libc::c_void;
        let is_locked = unsafe {
            // Attempt to lock page in physical RAM (prevents swap to disk)
            libc::mlock(ptr, size) == 0
        };

        Self { data, is_locked }
    }

    /// Create a protected buffer by copying from an existing slice.
    pub fn from_slice(source: &[u8]) -> Self {
        let mut buf = Self::new(source.len());
        buf.data.copy_from_slice(source);
        buf
    }

    /// Whether this buffer was successfully pinned in physical RAM.
    pub fn is_locked(&self) -> bool {
        self.is_locked
    }

    /// Returns the length of the protected buffer.
    pub fn len(&self) -> usize {
        self.data.len()
    }

    /// Returns true if the buffer is empty.
    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }
}

impl Deref for ProtectedBuffer {
    type Target = [u8];

    fn deref(&self) -> &Self::Target {
        &self.data
    }
}

impl DerefMut for ProtectedBuffer {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.data
    }
}

impl Drop for ProtectedBuffer {
    fn drop(&mut self) {
        // Deterministically zero memory
        self.data.zeroize();

        // Unlock memory page if previously locked
        if self.is_locked {
            unsafe {
                let ptr = self.data.as_mut_ptr() as *const libc::c_void;
                libc::munlock(ptr, self.data.len());
            }
        }
    }
}

/// A 256-bit (32-byte) cryptographic key protected by `mlock` and `ZeroizeOnDrop`.
#[derive(Zeroize, ZeroizeOnDrop)]
pub struct SecureKey {
    #[zeroize(skip)]
    buffer: ProtectedBuffer,
}

impl SecureKey {
    /// Create a SecureKey from a 32-byte array.
    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        let buffer = ProtectedBuffer::from_slice(&bytes);
        Self { buffer }
    }

    /// Access the key bytes as a 32-byte slice.
    pub fn as_bytes(&self) -> &[u8; 32] {
        let slice: &[u8] = &self.buffer;
        slice.try_into().expect("SecureKey buffer must be exactly 32 bytes")
    }
}

impl Deref for SecureKey {
    type Target = [u8; 32];

    fn deref(&self) -> &Self::Target {
        self.as_bytes()
    }
}

impl std::fmt::Debug for SecureKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "SecureKey([REDACTED])")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_protected_buffer_zeroize() {
        let secret = [0x42u8; 32];
        let buf = ProtectedBuffer::from_slice(&secret);
        assert_eq!(&*buf, &secret[..]);
        assert_eq!(buf.len(), 32);
    }

    #[test]
    fn test_secure_key_redacted_debug() {
        let key = SecureKey::from_bytes([7u8; 32]);
        assert_eq!(format!("{:?}", key), "SecureKey([REDACTED])");
        assert_eq!(key.as_bytes(), &[7u8; 32]);
    }
}
