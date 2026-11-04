#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Neural Gallery — Apple Silicon Standalone DMG Bundler & Ad-Hoc Signer
# ==============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PROJECT_DIR}"

APP_NAME="Neural Gallery"
BUNDLE_ID="com.neuralgallery.app"
VERSION="2.0.0"
OUTPUT_DIR="${PROJECT_DIR}/dist-dmg"
APP_DIR="${OUTPUT_DIR}/${APP_NAME}.app"

echo "=== [1/5] Compiling Native Swift Bridge ==="
./native/build.sh

echo "=== [2/5] Building React 19 Production Frontend ==="
npm run build

echo "=== [3/5] Assembling macOS Application Bundle ==="
rm -rf "${OUTPUT_DIR}"
mkdir -p "${APP_DIR}/Contents/MacOS"
mkdir -p "${APP_DIR}/Contents/Resources"
mkdir -p "${APP_DIR}/Contents/Frameworks"

# Copy icons
if [ -f "assets/AppIcon.icns" ]; then
    cp "assets/AppIcon.icns" "${APP_DIR}/Contents/Resources/AppIcon.icns"
fi

# Copy native dynamic library
cp "native/build/libneural_bridge.dylib" "${APP_DIR}/Contents/Frameworks/"

# Create Info.plist
cat > "${APP_DIR}/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>neural-gallery-launcher</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>${BUNDLE_ID}</string>
    <key>CFBundleName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleDisplayName</key>
    <string>${APP_NAME}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>${VERSION}</string>
    <key>CFBundleVersion</key>
    <string>${VERSION}</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <true/>
</dict>
</plist>
EOF

# Launcher executable script
cat > "${APP_DIR}/Contents/MacOS/neural-gallery-launcher" <<'EOF'
#!/bin/bash
DIR="$(cd "$(dirname "$0")/.." && pwd)"
export DYLD_FRAMEWORK_PATH="${DIR}/Frameworks:${DYLD_FRAMEWORK_PATH:-}"
export DYLD_LIBRARY_PATH="${DIR}/Frameworks:${DYLD_LIBRARY_PATH:-}"

if command -v neural-gallery >/dev/null 2>&1; then
    exec neural-gallery app
else
    # Fallback to local browser UI
    open "http://127.0.0.1:8765/"
fi
EOF
chmod +x "${APP_DIR}/Contents/MacOS/neural-gallery-launcher"

echo "=== [4/5] Ad-Hoc Code Signing (Gatekeeper Ready) ==="
codesign --force --deep --sign - "${APP_DIR}" 2>/dev/null || true

echo "=== [5/5] Creating Drag-and-Drop .dmg Installer ==="
DMG_PATH="${OUTPUT_DIR}/Neural_Gallery_${VERSION}_aarch64.dmg"
TEMP_DMG_DIR="${OUTPUT_DIR}/temp_dmg"
rm -rf "${TEMP_DMG_DIR}"
mkdir -p "${TEMP_DMG_DIR}"

cp -R "${APP_DIR}" "${TEMP_DMG_DIR}/"
ln -s /Applications "${TEMP_DMG_DIR}/Applications"

hdiutil create -volname "${APP_NAME}" -srcfolder "${TEMP_DMG_DIR}" -ov -format UDZO "${DMG_PATH}"
rm -rf "${TEMP_DMG_DIR}"

echo "=================================================="
echo "✓ DMG Build Complete: ${DMG_PATH}"
echo "=================================================="
