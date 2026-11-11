"""Generate the website's compact artwork reference index (requires Pillow).

Run from any directory. Existing website and mobile reference art is reused.
Use --fetch-missing for newly catalogued official artwork without a local copy.
The cache contains public reference art only; users' deck images never enter it.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from base64 import b64decode, b64encode

from PIL import Image


WEBSITE = Path(__file__).resolve().parents[1]
PUBLIC = WEBSITE / "public"
MOBILE = WEBSITE.parent / "mobile/HoloCardScanner/app/src/main/assets"
OUTPUT = PUBLIC / "deck-photo-index.v1.json"
OFFICIAL = "https://hololive-official-cardgame.com"
WIDTH, HEIGHT = 8, 10
MAX_IMAGE_BYTES = 5_000_000


def signature(path):
    with Image.open(path) as image:
        width, height = image.size
        if not (0.64 <= width / height <= 0.79) or min(width, height) < 60:
            raise ValueError(f"Unexpected card artwork dimensions: {width} × {height}")
        # Same sampling region as lib/deck-photo/artwork.mjs. Quantity overlays
        # normally cover the lower edge of the card and are read separately.
        grid = image.convert("RGB").resize(
            (WIDTH, HEIGHT), Image.Resampling.BOX,
            box=(width * .04, height * .04, width * .96, height * .78),
        )
        return b64encode(grid.tobytes()).decode("ascii")


def cached_signatures():
    if not OUTPUT.exists():
        return {}
    index = json.loads(OUTPUT.read_text(encoding="utf-8"))
    if index.get("version") != 1:
        return {}
    return {source: feature for _, _, _, source, feature in index["rows"]
            if len(b64decode(feature, validate=True)) == WIDTH * HEIGHT * 3}


def reference(row, art_map, cache, existing, fetch_missing):
    number, printing, section, url = row
    try:
        source = url.removeprefix(OFFICIAL) if url.startswith(f"{OFFICIAL}/") else url
        if source in existing:
            return [number, printing, section, source, existing[source]], None
        key = hashlib.sha256(url.encode()).hexdigest()[:20]
        paths = [PUBLIC / "card-art" / f"hbp09-{key}.webp", cache / f"{key}.img"]
        if url in art_map:
            paths.insert(0, MOBILE / art_map[url].lstrip("/"))
        if url.startswith("/") and not url.startswith("//"):
            paths.insert(0, PUBLIC / url.lstrip("/"))
        for path in paths:
            if path.is_file():
                return [number, printing, section, source, signature(path)], None
        official = urlsplit(url)
        if not fetch_missing or official.scheme != "https" or official.netloc != "hololive-official-cardgame.com" or not official.path.startswith("/wp-content/images/cardlist/"):
            raise FileNotFoundError("no local reference")
        request = Request(url, headers={"User-Agent": "Hololen deck photo reference index"})
        with urlopen(request, timeout=25) as response:
            data = response.read(MAX_IMAGE_BYTES + 1)
        if len(data) > MAX_IMAGE_BYTES:
            raise ValueError("artwork exceeds the size limit")
        with NamedTemporaryFile(dir=cache, suffix=".tmp", delete=False) as output:
            output.write(data)
            temporary = Path(output.name)
        try:
            feature = signature(temporary)
            temporary.replace(cache / f"{key}.img")
        finally:
            temporary.unlink(missing_ok=True)
        return [number, printing, section, source, feature], None
    except (OSError, ValueError) as error:
        return None, f"{number} / {printing}: {error}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--fetch-missing", action="store_true")
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    catalog = json.loads((PUBLIC / "cards.json").read_text(encoding="utf-8"))
    art_map_path = MOBILE / "art-map.json"
    art_map = json.loads(art_map_path.read_text(encoding="utf-8")) if art_map_path.exists() else {}
    existing = cached_signatures()
    rows = [(card["number"], variant["id"], card["group"] if card["group"] in ("oshi", "cheer") else "main", variant["image"])
            for card in catalog["cards"] if not card.get("simOnly")
            for variant in card["variants"] if variant.get("image")]
    entries, errors = [], []
    with ThreadPoolExecutor(max_workers=8) as pool:
        for position, (entry, error) in enumerate(pool.map(
            lambda row: reference(row, art_map, args.cache, existing, args.fetch_missing), rows
        ), 1):
            if entry:
                entries.append(entry)
            if error:
                errors.append(error)
            if position % 250 == 0:
                print(f"{position}/{len(rows)} references processed", flush=True)
    if errors:
        raise SystemExit(f"{len(errors)} reference images unavailable:\n" + "\n".join(errors[:30]))
    with NamedTemporaryFile(mode="w", dir=PUBLIC, suffix=".tmp", encoding="utf-8", delete=False) as output:
        temporary = Path(output.name)
        output.write('{"version":1,"rows":[\n')
        output.write(",\n".join(json.dumps(row, separators=(",", ":")) for row in entries))
        output.write("\n]}\n")
    temporary.replace(OUTPUT)
    print(f"Wrote {len(entries)} printing references to {OUTPUT.name}")


if __name__ == "__main__":
    main()
