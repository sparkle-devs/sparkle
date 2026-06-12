#!/usr/bin/bash
# Compress all of the files required for a working Sparkle installation into dist. Contains sparkle.zip (the code),
# the raw sparkle.js, sparkle.min.js (minified version of sparkle.js), and sparkle.bookmarklet.js (sparkle.min.js
# as a bookmarklet)

mkdir -p dist
rm -f dist/sparkle.zip
zip -9 dist/sparkle.zip LICENSE index.js manifest.json icons/*
cp index.js dist/sparkle.js
npx terser dist/sparkle.js -c -m -o dist/sparkle.min.js
printf 'javascript:' > dist/sparkle.bookmarklet.js
cat dist/sparkle.min.js >> dist/sparkle.bookmarklet.js
