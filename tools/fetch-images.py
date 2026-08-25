#!/usr/bin/env python3
"""
fetch-images.py — download every remote photo into the repository and
rewrite data/*.json to point at the local copies.

Why you should run this once, before going live:

  * Speed. Local files sit next to the site on GitHub's CDN. Remote
    redirects add a round trip to every single image.
  * Reliability. If Wikimedia renames or deletes a file, or blocks the
    request, your site shows a broken gallery. Local copies cannot break.
  * Courtesy. Wikimedia asks that you not hotlink their servers for
    production traffic.

Usage, from the repository root:

    python3 tools/fetch-images.py            # download and rewrite
    python3 tools/fetch-images.py --check    # only test the URLs
    python3 tools/fetch-images.py --dry-run  # show what would happen

Photo credits in the JSON are preserved — they still have to be shown,
and the site already displays them under each gallery.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
IMAGES = os.path.join(ROOT, "assets", "images")

# Wikimedia asks for a descriptive agent. Put your own contact here.
UA = "WuMinjunSite/1.0 (private tour site; contact: wuminjun.uz@example.com)"

FILES = ["cities", "places", "tours", "settings"]


def slug(text, fallback="image"):
    out = re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-")
    return out[:60] or fallback


def walk(node, visit, owner="misc"):
    """Visit every {src: ...} object, tracking which record it belongs to."""
    if isinstance(node, dict):
        if "id" in node and isinstance(node["id"], str):
            owner = node["id"]
        if "src" in node and isinstance(node["src"], str):
            visit(node, owner)
            return
        for value in node.values():
            walk(value, visit, owner)
    elif isinstance(node, list):
        for value in node:
            walk(value, visit, owner)


def download(url, dest):
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=60) as response:
        content_type = response.headers.get("Content-Type", "")
        if not content_type.startswith("image/"):
            raise ValueError(f"not an image ({content_type or 'no content type'})")
        payload = response.read()
    ext = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}.get(
        content_type.split(";")[0].strip(), ".jpg"
    )
    dest = dest + ext
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "wb") as handle:
        handle.write(payload)
    return dest, len(payload)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="test the URLs without downloading")
    parser.add_argument("--dry-run", action="store_true", help="list what would be downloaded")
    args = parser.parse_args()

    payloads = {}
    targets = []

    for name in FILES:
        path = os.path.join(DATA, f"{name}.json")
        with open(path, encoding="utf-8") as handle:
            payloads[name] = json.load(handle)

        def visit(node, owner, _name=name):
            if node["src"].startswith("http"):
                targets.append((node, owner, _name))

        walk(payloads[name], visit)

    if not targets:
        print("Every image is already local. Nothing to do.")
        return 0

    print(f"{len(targets)} remote images found.\n")
    counters = {}
    failures = []

    for index, (node, owner, name) in enumerate(targets, 1):
        counters[owner] = counters.get(owner, 0) + 1
        number = counters[owner]
        folder = {"cities": "cities", "places": "places", "tours": "tours", "settings": "site"}[name]
        stem = os.path.join(IMAGES, folder, f"{slug(owner)}-{number:02d}")
        label = f"[{index:>3}/{len(targets)}] {slug(owner)}-{number:02d}"

        if args.dry_run:
            print(f"{label}  ←  {node['src'][:90]}")
            continue

        try:
            if args.check:
                request = urllib.request.Request(node["src"], method="HEAD", headers={"User-Agent": UA})
                response = urllib.request.urlopen(request, timeout=30)
                content_type = response.headers.get("Content-Type", "")
                ok = response.status == 200 and content_type.startswith("image/")
                print(f"{label}  {'ok' if ok else 'BAD ' + str(response.status)}  {content_type}")
                if not ok:
                    failures.append((node["src"], content_type))
            else:
                written, size = download(node["src"], stem)
                node["src"] = os.path.relpath(written, ROOT).replace(os.sep, "/")
                print(f"{label}  {size // 1024:>5} KB  →  {node['src']}")
            time.sleep(0.25)  # be polite to the server
        except (urllib.error.URLError, urllib.error.HTTPError, ValueError, OSError) as error:
            print(f"{label}  FAILED: {error}")
            failures.append((node["src"], str(error)))

    if args.dry_run:
        return 0

    if not args.check:
        for name in FILES:
            path = os.path.join(DATA, f"{name}.json")
            with open(path, "w", encoding="utf-8") as handle:
                json.dump(payloads[name], handle, ensure_ascii=False, indent=2)
                handle.write("\n")
        print(f"\nRewrote {len(FILES)} JSON files to use local paths.")

    if failures:
        print(f"\n{len(failures)} image(s) failed:")
        for url, reason in failures:
            print(f"  {reason}\n    {url}")
        print(
            "\nAnything that failed keeps its remote URL, and the site will show a\n"
            "patterned tile in its place. Replace those entries with your own\n"
            "photographs in the admin panel — which is what you want anyway."
        )
        return 1

    print("\nDone. Commit the new files under assets/images/ along with data/.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
