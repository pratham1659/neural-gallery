import os
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class TestPhase7Distribution(unittest.TestCase):
    """Test suite for Phase 7: GitHub CI/CD, Packaging & Open-Source Distribution."""

    def test_github_ci_workflow_exists(self):
        """Verify CI workflow file exists."""
        ci_file = ROOT / ".github" / "workflows" / "ci.yml"
        self.assertTrue(ci_file.exists(), "ci.yml workflow must exist")
        content = ci_file.read_text(encoding="utf-8")
        self.assertIn("macos-14", content)
        self.assertIn("dtolnay/rust-toolchain", content)
        self.assertIn("native/build.sh", content)
        self.assertIn("cargo test", content)

    def test_github_release_workflow_exists(self):
        """Verify Release workflow file exists."""
        rel_file = ROOT / ".github" / "workflows" / "release.yml"
        self.assertTrue(rel_file.exists(), "release.yml workflow must exist")
        content = rel_file.read_text(encoding="utf-8")
        self.assertIn("macos-14", content)
        self.assertIn("action-gh-release", content)
        self.assertIn("build_dmg.sh", content)
        self.assertIn("SHA256SUMS.txt", content)

    def test_homebrew_cask_formula(self):
        """Verify Homebrew Cask formula exists and is configured for Apple Silicon."""
        cask_file = ROOT / "Casks" / "neural-gallery.rb"
        self.assertTrue(cask_file.exists(), "Casks/neural-gallery.rb must exist")
        content = cask_file.read_text(encoding="utf-8")
        self.assertIn('cask "neural-gallery"', content)
        self.assertIn('depends_on arch: :arm64', content)
        self.assertIn('app "Neural Gallery.app"', content)
        self.assertIn('xattr', content)

    def test_build_dmg_script(self):
        """Verify build_dmg.sh script is executable and contains assembly steps."""
        script_file = ROOT / "scripts" / "build_dmg.sh"
        self.assertTrue(script_file.exists(), "scripts/build_dmg.sh must exist")
        self.assertTrue(os.access(script_file, os.X_OK), "scripts/build_dmg.sh must be executable")
        content = script_file.read_text(encoding="utf-8")
        self.assertIn("hdiutil create", content)
        self.assertIn("codesign --force --deep --sign -", content)
        self.assertIn("libneural_bridge.dylib", content)


if __name__ == "__main__":
    unittest.main()
