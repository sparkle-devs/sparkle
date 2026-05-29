#!/usr/bin/sh
# Compress all of the files required for a working Sparkle installation into a file named sparkle.zip.
mkdir -p dist/
cd dist/
rm -f sparkle.zip
zip -9 sparkle.zip ../icons/* ../LICENSE ../index.js ../manifest.json
cp ../sparkle.js sparkle.js
