cask "neural-gallery" do
  version "2.0.0"
  sha256 :no_check

  url "https://github.com/pratham1659/neural-gallery/releases/download/v#{version}/Neural.Gallery_#{version}_aarch64.dmg"
  name "Neural Gallery"
  desc "Encrypted zero-knowledge photo gallery and AI vault for Apple Silicon macOS"
  homepage "https://github.com/pratham1659/neural-gallery"

  depends_on arch: :arm64
  depends_on macos: ">= :monterey"

  app "Neural Gallery.app"

  postflight do
    system_command "xattr",
                   args: ["-cr", "#{appdir}/Neural Gallery.app"],
                   sudo: false
  end

  zap trash: [
    "~/Library/Application Support/Neural Gallery",
    "~/Library/Preferences/com.neuralgallery.app.plist",
    "~/Library/Saved Application State/com.neuralgallery.app.savedState",
  ]
end
