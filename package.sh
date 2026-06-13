#!/usr/bin/sh
# Compress all of the files required for a working Sparkle installation into a file named sparkle.zip.
mkdir -p dist
rm -f dist/sparkle.zip
zip -9 dist/sparkle.zip LICENSE index.js manifest.json icons/*
cp index.js dist/sparkle.js
