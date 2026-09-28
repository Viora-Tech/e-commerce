"""Builds the Live view globe's dashed-border points: apps/admin/public/globe/borders.bin.

The "Look > Border style: Dashed" setting draws country borders as a dashed line (- - - -,
like an official map) instead of the shader's solid line (`webgl/globe-renderer.ts`'s
solid-border pass, read from `globe-2048.png`'s green channel); coastlines always stay solid
either way. This script builds the dash points once, offline, from the same source data as
that map.

Data: Natural Earth 1:10m admin-0 countries, **India point of view** (public domain, "Made with
Natural Earth") — the same file `make-globe-map.py` uses, so India's boundary is the same
official one (all of Jammu & Kashmir and Ladakh, including Aksai Chin, and Arunachal Pradesh).
Never swap in the default-view file.

  curl -sSLO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries_ind.geojson
  python scripts/globe/make-globe-borders.py ne_10m_admin_0_countries_ind.geojson apps/admin/public/globe/borders.bin

How a border edge is told apart from a coastline: every ring edge's midpoint is tested against
the land mask eroded inward by a small margin (the same erosion `make-globe-map.py` uses to
keep its border line off the coast). An edge whose midpoint survives the erosion runs well
inside land, so it is either a shared country-country border or (for a shared boundary, which
Natural Earth stores as identical coordinates on both sides) counted twice, once per country;
a coastline's midpoint sits right at the land/sea edge and never does.

Kept edges are chained into runs (a run breaks wherever the border touches the coast) and each
run is resampled to ~3.5 km spacing — dense enough that consecutive points read as a continuous
line up close, since the shader decides on/off per point rather than drawing real line segments
— tracking each point's *cumulative distance along its own run* as it goes. The shader turns
that distance, plus the globe's current on-screen radius, back into an on/off dash pattern that
keeps the same length in screen pixels at any zoom (see `webgl/border-dash.ts` and
`globe-renderer.ts`'s border-stroke draw call). Both lat/lng and the running distance are
quantised before being written, which happens to also merge the two copies of every shared
border into one (both sides carry identical coordinates), and keeps the file small.

Output format (little-endian): a uint32 point count, then that many `(int16 lat100, int16
lng100, uint16 arc10k)` triples — `arc10k` is the point's distance along its run, in radians of
the sphere's surface (real-world distance / Earth's radius) times 10000, reset to 0 at the start
of every run. Plain and repetitive, so it gzips well over HTTP.
"""

import json
import math
import struct
import sys

from PIL import Image, ImageDraw, ImageFilter

WIDTH, HEIGHT = 2048, 1024
# How far inland an edge's midpoint must sit to count as a border rather than a coastline.
EROSION_PX = 2
RESAMPLE_KM = 3.5
EARTH_RADIUS_KM = 6371.0
# uint16 headroom: 65535 / 10000 = 6.55 radians ≈ 41,700 km along one run — comfortably more
# than the longest real border (the US/Canada line is under 9,000 km).
ARC_SCALE = 10_000
ARC_MAX = 65_535


def rings(geometry):
    polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
    for polygon in polygons:
        yield polygon


def project(lng: float, lat: float) -> tuple[float, float]:
    return (lng + 180) / 360 * WIDTH, (90 - lat) / 180 * HEIGHT


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lng1, lat1 = math.radians(a[0]), math.radians(a[1])
    lng2, lat2 = math.radians(b[0]), math.radians(b[1])
    dlat, dlng = lat2 - lat1, lng2 - lng1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(min(1, math.sqrt(h)))


def resample(points: list[tuple[float, float]], step_km: float) -> list[tuple[float, float, float]]:
    """Walks a polyline (lng, lat pairs) and keeps a `(lng, lat, cumulative_km)` point every
    `step_km`, plus the last one, `cumulative_km` starting at 0 for this run."""
    if not points:
        return []
    out: list[tuple[float, float, float]] = [(*points[0], 0.0)]
    since_last = 0.0
    total = 0.0
    for a, b in zip(points, points[1:]):
        seg = haversine_km(a, b)
        if seg <= 0:
            continue
        pos = 0.0
        while since_last + (seg - pos) >= step_km:
            need = step_km - since_last
            t = (pos + need) / seg
            total += need
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, total))
            pos += need
            since_last = 0.0
        remaining = seg - pos
        since_last += remaining
        total += remaining
    if out[-1][:2] != points[-1]:
        out.append((*points[-1], total))
    return out


def build_land_mask(countries: dict) -> Image.Image:
    land = Image.new("L", (WIDTH, HEIGHT), 0)
    fill = ImageDraw.Draw(land)
    for feature in countries["features"]:
        for polygon in rings(feature["geometry"]):
            fill.polygon([project(*p) for p in polygon[0]], fill=255)
            for hole in polygon[1:]:
                fill.polygon([project(*p) for p in hole], fill=0)
    land = land.point(lambda v: 255 if v > 127 else 0)
    return land.filter(ImageFilter.MinFilter(2 * EROSION_PX + 1))


def main(src: str, out: str) -> None:
    countries = json.load(open(src, encoding="utf-8"))
    inland = build_land_mask(countries)
    inland_px = inland.load()

    def is_inland(lng: float, lat: float) -> bool:
        x, y = project(lng, lat)
        xi = min(WIDTH - 1, max(0, int(x)))
        yi = min(HEIGHT - 1, max(0, int(y)))
        return inland_px[xi, yi] > 127

    seen: set[tuple[int, int]] = set()
    points: list[tuple[int, int, int]] = []
    for feature in countries["features"]:
        for polygon in rings(feature["geometry"]):
            for ring in polygon:
                edges = list(zip(ring, ring[1:] + ring[:1]))
                run: list[tuple[float, float]] = []

                def flush():
                    if len(run) < 2:
                        run.clear()
                        return
                    for lng, lat, cum_km in resample(run, RESAMPLE_KM):
                        key = (round(lat * 100), round(lng * 100))
                        if key in seen:
                            continue
                        seen.add(key)
                        arc10k = min(ARC_MAX, round((cum_km / EARTH_RADIUS_KM) * ARC_SCALE))
                        points.append((key[0], key[1], arc10k))
                    run.clear()

                for a, b in edges:
                    # Skip antimeridian-crossing edges (Russia, Fiji): not a real border segment.
                    if abs(a[0] - b[0]) > 180:
                        flush()
                        continue
                    mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
                    if is_inland(*mid):
                        if not run:
                            run.append(a)
                        run.append(b)
                    else:
                        flush()
                flush()

    with open(out, "wb") as f:
        f.write(struct.pack("<I", len(points)))
        for lat100, lng100, arc10k in points:
            f.write(struct.pack("<hhH", lat100, lng100, arc10k))

    size = len(points) * 6 + 4
    print(f"{len(points)} border points -> {out} ({size} bytes, {size / 1024:.0f} KB)")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
