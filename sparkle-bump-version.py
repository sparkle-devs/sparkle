import tomllib, json, re, tomli_w
f = open("version.json")
version = json.loads(f.read())
f.close()

f = open("manifest.json")
manifest = json.loads(f.read())
manifest["version"] = ".".join(version)
f.close()

f = open("manifest.json", "w")
f.write(json.dumps(manifest, indent=4))
f.close()

f = open("bonobo.toml", "rb")
bonobo = tomllib.load(f)
f.close()

bonobo["userscript"]["version"] = f"v{".".join(version)}"

f = open("bonobo.toml", "w")
f.write(tomli_w.dumps(bonobo))
f.close()

#f = open("index.js", "w+")
#js = f.read()
#js = re.sub(r"^.* \/\/ sparkle-bump-version.py: UPDATE THIS LINE!$", f'versionArray: [f{", ".join(version)}] // sparkle-bump-version.py: UPDATE THIS LINE!', js)
#f.write(js)
