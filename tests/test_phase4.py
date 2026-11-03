import os
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC_TAURI = ROOT / "src-tauri"


class TestPhase4TauriAndCrypto(unittest.TestCase):
    """Test suite for Phase 4: Tauri 2.0 Core & Cryptographic EVFS Engine."""

    def test_tauri_project_files_exist(self):
        """Verify essential Tauri 2.0 workspace and configuration files exist."""
        self.assertTrue((SRC_TAURI / "Cargo.toml").exists(), "src-tauri/Cargo.toml must exist")
        self.assertTrue((SRC_TAURI / "tauri.conf.json").exists(), "src-tauri/tauri.conf.json must exist")
        self.assertTrue((SRC_TAURI / "build.rs").exists(), "src-tauri/build.rs must exist")
        self.assertTrue((SRC_TAURI / "src" / "lib.rs").exists(), "src-tauri/src/lib.rs must exist")
        self.assertTrue((SRC_TAURI / "src" / "main.rs").exists(), "src-tauri/src/main.rs must exist")

    def test_crypto_modules_exist(self):
        """Verify cryptographic EVFS, KDF, and memory guard modules exist."""
        crypto_dir = SRC_TAURI / "src" / "crypto"
        self.assertTrue((crypto_dir / "mod.rs").exists())
        self.assertTrue((crypto_dir / "kdf.rs").exists())
        self.assertTrue((crypto_dir / "evfs.rs").exists())
        self.assertTrue((crypto_dir / "memguard.rs").exists())

    def test_bridge_and_state_modules_exist(self):
        """Verify Swift FFI bridge and VaultState lifecycle modules exist."""
        bridge_dir = SRC_TAURI / "src" / "bridge"
        self.assertTrue((bridge_dir / "mod.rs").exists())
        self.assertTrue((bridge_dir / "swift.rs").exists())
        self.assertTrue((SRC_TAURI / "src" / "state.rs").exists())
        self.assertTrue((SRC_TAURI / "src" / "commands.rs").exists())
        self.assertTrue((SRC_TAURI / "src" / "lifecycle.rs").exists())

    def test_cargo_test_passes(self):
        """Verify all 12 native Rust unit tests pass cleanly."""
        cargo_env = os.environ.copy()
        cargo_bin = Path.home() / ".cargo" / "bin"
        if cargo_bin.exists():
            cargo_env["PATH"] = f"{cargo_bin}:{cargo_env.get('PATH', '')}"

        proc = subprocess.run(
            ["cargo", "test", "--quiet"],
            cwd=str(SRC_TAURI),
            env=cargo_env,
            capture_output=True,
            text=True,
            timeout=120,
        )
        self.assertEqual(
            proc.returncode,
            0,
            f"Cargo test failed:\nSTDOUT: {proc.stdout}\nSTDERR: {proc.stderr}",
        )
        self.assertIn("0 failed", proc.stdout)
        self.assertIn("test result: ok", proc.stdout)


if __name__ == "__main__":
    unittest.main()
