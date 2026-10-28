# Puts the logos into src/index.src.html and writes index.html.
import json, pathlib, sys
root = pathlib.Path(__file__).resolve().parent.parent
logos = json.loads((root / "dev" / "logos.json").read_text())
html = (root / "src" / "index.src.html").read_text()
for k, v in logos.items():
    html = html.replace("%%" + k + "%%", v)
(root / "index.html").write_text(html)
print("index.html", len(html))
