#!/usr/bin/env bash
# Regenerate every app icon from resources/icon.html:
#   resources/icon.png  (master, 1024)   — Linux + source of truth
#   resources/icon.icns (macOS)
#   resources/icon.ico  (Windows)
# Requires macOS (sips + iconutil are built in).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "1/3  rendering icon.png from icon.html…"
node scripts/make-icon.mjs

echo "2/3  building icon.icns…"
SET="resources/icon.iconset"
rm -rf "$SET"; mkdir "$SET"
sips -z 16 16     resources/icon.png --out "$SET/icon_16x16.png"      >/dev/null
sips -z 32 32     resources/icon.png --out "$SET/icon_16x16@2x.png"   >/dev/null
sips -z 32 32     resources/icon.png --out "$SET/icon_32x32.png"      >/dev/null
sips -z 64 64     resources/icon.png --out "$SET/icon_32x32@2x.png"   >/dev/null
sips -z 128 128   resources/icon.png --out "$SET/icon_128x128.png"    >/dev/null
sips -z 256 256   resources/icon.png --out "$SET/icon_128x128@2x.png" >/dev/null
sips -z 256 256   resources/icon.png --out "$SET/icon_256x256.png"    >/dev/null
sips -z 512 512   resources/icon.png --out "$SET/icon_256x256@2x.png" >/dev/null
sips -z 512 512   resources/icon.png --out "$SET/icon_512x512.png"    >/dev/null
sips -z 1024 1024 resources/icon.png --out "$SET/icon_512x512@2x.png" >/dev/null
iconutil -c icns "$SET" -o resources/icon.icns
rm -rf "$SET"
# normalise the master to 1024
sips -z 1024 1024 resources/icon.png --out resources/icon.png >/dev/null

echo "3/3  building icon.ico…"
node scripts/make-ico.mjs

echo "done. resources/: icon.png, icon.icns, icon.ico"
