#!/usr/bin/bash
# Compress all of the files required for a working Sparkle installation into a file named sparkle.zip. Requires node.js.
mkdir -p dist/
cd dist/
rm -f sparkle.zip
zip -9 sparkle.zip ../icons/* ../LICENSE ../index.js ../manifest.json
cp ../index.js sparkle.js
npx terser  sparkle.js -c -m -o sparkle.min.js
printf "javascript:%s" $(< sparkle.min.js)  > sparkle.bookmarklet.js
