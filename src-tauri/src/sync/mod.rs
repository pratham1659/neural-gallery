use rand::Rng;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use subtle::ConstantTimeEq;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerDevice {
    pub id: String,
    pub name: String,
    pub model: String,
    pub state: String,
    pub last_sync: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub status: String,
    pub service_name: String,
    pub vault_id: String,
    pub sas_pin: String,
    pub tls_version: String,
    pub mesh_active: bool,
    pub devices: Vec<PeerDevice>,
}

pub struct SyncMeshState {
    pub vault_id: String,
    pub sas_pin: String,
    pub devices: Vec<PeerDevice>,
}

impl SyncMeshState {
    pub fn new() -> Self {
        let vault_id = Uuid::new_v4().to_string();
        let sas_pin = generate_sas_pin();

        let devices = vec![
            PeerDevice {
                id: "dev-iphone-16".to_string(),
                name: "Pratham's iPhone 16 Pro".to_string(),
                model: "iPhone17,1".to_string(),
                state: "paired".to_string(),
                last_sync: "Just now".to_string(),
            },
            PeerDevice {
                id: "dev-pixel-9".to_string(),
                name: "Pixel 9 Pro XL".to_string(),
                model: "Pixel 9 Pro".to_string(),
                state: "nearby".to_string(),
                last_sync: "Yesterday".to_string(),
            },
        ];

        Self {
            vault_id,
            sas_pin,
            devices,
        }
    }

    pub fn verify_pin(&self, input_pin: &str) -> bool {
        let clean_input: String = input_pin.chars().filter(|c| c.is_ascii_digit()).collect();
        let clean_actual: String = self.sas_pin.chars().filter(|c| c.is_ascii_digit()).collect();

        if clean_input.len() != 6 || clean_actual.len() != 6 {
            return false;
        }

        clean_input.as_bytes().ct_eq(clean_actual.as_bytes()).into()
    }

    pub fn rotate_pin(&mut self) -> String {
        self.sas_pin = generate_sas_pin();
        self.sas_pin.clone()
    }

    pub fn pair_device(&mut self, id: &str, pin: &str, name: &str, model: &str) -> Result<PeerDevice, String> {
        if !self.verify_pin(pin) {
            return Err("Invalid 6-digit SAS pairing PIN".to_string());
        }

        if let Some(pos) = self.devices.iter().position(|d| d.id == id) {
            self.devices[pos].state = "paired".to_string();
            self.devices[pos].last_sync = "Just now".to_string();
            return Ok(self.devices[pos].clone());
        }

        let dev = PeerDevice {
            id: id.to_string(),
            name: if name.is_empty() { format!("Device {}", &id[..6.min(id.len())]) } else { name.to_string() },
            model: if model.is_empty() { "Mobile Device".to_string() } else { model.to_string() },
            state: "paired".to_string(),
            last_sync: "Just now".to_string(),
        };

        self.devices.push(dev.clone());
        Ok(dev)
    }
}

pub fn generate_sas_pin() -> String {
    let mut rng = rand::thread_rng();
    let num1 = rng.gen_range(100..=999);
    let num2 = rng.gen_range(100..=999);
    format!("{} {}", num1, num2)
}

pub struct SyncMeshManager {
    inner: Arc<Mutex<SyncMeshState>>,
}

impl SyncMeshManager {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(SyncMeshState::new())),
        }
    }

    pub fn status(&self) -> SyncStatus {
        let state = self.inner.lock().unwrap();
        SyncStatus {
            status: "ready".to_string(),
            service_name: "_photovault._tcp.local.".to_string(),
            vault_id: state.vault_id.clone(),
            sas_pin: state.sas_pin.clone(),
            tls_version: "TLS 1.3".to_string(),
            mesh_active: true,
            devices: state.devices.clone(),
        }
    }

    pub fn pair(&self, id: String, pin: String, name: Option<String>, model: Option<String>) -> Result<PeerDevice, String> {
        let mut state = self.inner.lock().unwrap();
        state.pair_device(&id, &pin, name.as_deref().unwrap_or(""), model.as_deref().unwrap_or(""))
    }

    pub fn rotate_pin(&self) -> String {
        let mut state = self.inner.lock().unwrap();
        state.rotate_pin()
    }
}

impl Default for SyncMeshManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sas_pin_generation_and_verification() {
        let mut state = SyncMeshState::new();
        let pin = state.sas_pin.clone();

        // Exact match
        assert!(state.verify_pin(&pin));

        // Match without spaces
        let clean_pin = pin.replace(" ", "");
        assert!(state.verify_pin(&clean_pin));

        // Wrong pin fails
        assert!(!state.verify_pin("000 000"));
        assert!(!state.verify_pin("12345"));

        // Rotate PIN changes value
        let new_pin = state.rotate_pin();
        assert_ne!(pin, new_pin);
        assert!(state.verify_pin(&new_pin));
    }

    #[test]
    fn test_device_pairing_flow() {
        let mut state = SyncMeshState::new();
        let pin = state.sas_pin.clone();

        let res = state.pair_device("dev-new-ipad", &pin, "iPad Pro M4", "iPad16,3");
        assert!(res.is_ok());
        let dev = res.unwrap();
        assert_eq!(dev.id, "dev-new-ipad");
        assert_eq!(dev.state, "paired");

        // Fail on wrong pin
        let err = state.pair_device("dev-fail", "000000", "Attacker Device", "Unknown");
        assert!(err.is_err());
    }
}
