"""Builds the Live view globe's map: apps/admin/public/globe/globe-2048.png.

One 2048x1024 RGB image, equirectangular, north up, longitude -180 at the left edge:
  R = land (filled country polygons), edge softened by a small blur so the shader's 0.5
      threshold follows the true coast smoothly instead of the pixel staircase,
  G = borders between countries (not coasts: outlines within a few pixels of the sea are
      masked out, the shader draws coasts from R), drawn 1 px then blurred so the shader can
      turn the value back into a distance and draw crisp lines of constant width at every zoom.

Data: Natural Earth 1:10m admin-0 countries, **India point of view** (public domain,
"Made with Natural Earth"). The point-of-view dataset draws India's boundary the way the
Government of India does (all of Jammu & Kashmir and Ladakh, including Aksai Chin, and
Arunachal Pradesh). Never swap in the default-view file.

  curl -sSLO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries_ind.geojson
  python scripts/globe/make-globe-map.py ne_10m_admin_0_countries_ind.geojson apps/admin/public/globe/globe-2048.png
"""

import json
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter

WIDTH, HEIGHT = 2048, 1024
BLUR = 1.4


def rings(geometry):
    polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
    for polygon in polygons:
        yield polygon


def main(src: str, out: str) -> None:
    countries = json.load(open(src, encoding="utf-8"))
    land = Image.new("L", (WIDTH, HEIGHT), 0)
    lines = Image.new("L", (WIDTH, HEIGHT), 0)
    fill = ImageDraw.Draw(land)
    stroke = ImageDraw.Draw(lines)

    def project(ring):
        return [((lng + 180) / 360 * WIDTH, (90 - lat) / 180 * HEIGHT) for lng, lat in ring]

    for feature in countries["features"]:
        for polygon in rings(feature["geometry"]):
            outer = project(polygon[0])
            fill.polygon(outer, fill=255)
            for hole in polygon[1:]:
                fill.polygon(project(hole), fill=0)
            # Skip segments that jump across the antimeridian (Russia, Fiji).
            for a, b in zip(outer, outer[1:] + outer[:1]):
                if abs(a[0] - b[0]) < WIDTH / 2:
                    stroke.line([a, b], fill=255, width=1)

    land = land.point(lambda v: 255 if v > 127 else 0)
    # Keep only borders well inland: erode the land by 3 px and mask the outlines with it.
    inland = land.filter(ImageFilter.MinFilter(7))
    lines = ImageChops.multiply(lines, inland)
    lines = lines.filter(ImageFilter.GaussianBlur(BLUR))
    peak = max(lines.getextrema()[1], 1)
    lines = lines.point(lambda v: min(255, round(v * 255 / peak)))
    soft_land = land.filter(ImageFilter.GaussianBlur(0.9))
    Image.merge("RGB", (soft_land, lines, Image.new("L", (WIDTH, HEIGHT), 0))).save(out, optimize=True)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
