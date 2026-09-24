"""Build the web thumbnails of the Pokémon art from the owner-decrypted client.

The Pokédex, the Tier list and the pickers draw the 140 px Pokémon illustrations at 64 px or
smaller. Serving the originals (about 21 KB each) made the Tier list download over 20 MB, so
this script writes WebP thumbnails at 64 px (1x) and 128 px (2x) under public/pokemon/, about
2.6 KB and 5.7 KB each. Only the files that content/pokemon.json names in `imagen` are built.

Usage (read-only on the client folder; needs Pillow):
    python scripts/assets/pokemon-thumbs.py <client>/data/images/pokemons
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

SIZES = (64, 128, 140)
QUALITY = 82
REPO = Path(__file__).resolve().parents[2]


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    source = Path(sys.argv[1])
    if not source.is_dir():
        print(f"No existe la carpeta {source}")
        return 2
    records = json.loads((REPO / "content" / "pokemon.json").read_text(encoding="utf-8"))["pokemon"]
    names = sorted({Path(r["imagen"]).name for r in records if r.get("imagen")})
    built, missing = 0, []
    for name in names:
        art = source / name
        if not art.is_file():
            missing.append(name)
            continue
        image = Image.open(art).convert("RGBA")
        for size in SIZES:
            out = REPO / "public" / "pokemon" / str(size) / (Path(name).stem + ".webp")
            out.parent.mkdir(parents=True, exist_ok=True)
            image.resize((size, size), Image.LANCZOS).save(out, "WEBP", quality=QUALITY, method=6)
        built += 1
    print(f"Miniaturas: {built} de {len(names)}; sin arte en el cliente: {', '.join(missing) or 'ninguna'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
