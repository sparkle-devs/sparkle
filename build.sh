#!/usr/bin/sh
# Compress all of the files required for a working Sparkle installation into a file named sparkle.zip.
rm -f sparkle.zip
zip -9 sparkle.zip icons/* LICENSE index.js manifest.json reload.js
