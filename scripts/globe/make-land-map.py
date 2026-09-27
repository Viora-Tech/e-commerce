"""Rebuilds the globes' land map (apps/admin/public/globe and patches/cobe@2.0.1.patch).

cobe ships a 256x128 land mask (about 1.4 degrees a pixel), too coarse for India
and Sri Lanka to read correctly. This rasterises Natural Earth 1:50m land (public
domain) to 2048x1024, equirectangular, north up, longitude -180 at the left edge,
white land on black sea, the same layout as cobe's own texture.

  curl -sSLO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson
  python scripts/globe/make-land-map.py ne_50m_land.geojson land-2048.png

Copy the PNG to apps/admin/public/globe/land-2048.png (our Live view globe reads it
from there), then base64 it into the `data:image/png;base64,` string in cobe's
dist/index.esm.js and regenerate the patch (the Home card's cobe globe).
"""

import json
import sys

from PIL import Image, ImageDraw

WIDTH, HEIGHT = 2048, 1024


def main(src: str, out: str) -> None:
    land = json.load(open(src, encoding="utf-8"))
    image = Image.new("L", (WIDTH, HEIGHT), 0)
    draw = ImageDraw.Draw(image)

    def project(ring):
        return [((lng + 180) / 360 * WIDTH, (90 - lat) / 180 * HEIGHT) for lng, lat in ring]

    for feature in land["features"]:
        geometry = feature["geometry"]
        polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
        for polygon in polygons:
            draw.polygon(project(polygon[0]), fill=255)
            for hole in polygon[1:]:
                draw.polygon(project(hole), fill=0)

    image.point(lambda v: 255 if v > 127 else 0).convert("1").save(out, optimize=True)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
