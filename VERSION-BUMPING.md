# Maintainer's guide to version bumping
## index.js
In the userscript metadata block near the top, find this line:
~~~javascript
// @version     0.12.0
~~~

and change the version as needed.

Afterwards, use your IDE's string-finding tool to search for the string `SEMVER-VAR`. You should find a snippet like this:
~~~javascript
window.__crackle__ = {
  versionArray: [0, 12, 0] // Maintainers: Change this array to match current version ([major, minor, patch]). Keyword for find-and-replace search: SEMVER-VAR.
};
~~~

Change `versionArray` to match the version, using the `[major, minor, patch]` format.

## version.json
In `version.json`, modify the file's contents to the following array, where `major`, `minor`, and `patch` are the first, second, and third components of the version number, respectively: `["major", "minor", "patch"]`.

A GitHub Actions bot will proceed to bump the version numbers in `manifest.json` and `bonobo.toml`.
