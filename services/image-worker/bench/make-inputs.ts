/**
 * Sample inputs for the comparison, written to bench/.out/inputs (git-ignored). Synthetic,
 * photo-like images (smooth light, texture, sensor noise, hard edges) at real upload sizes, plus
 * two images already in the repo. No customer photos.
 *
 *   bun services/image-worker/bench/make-inputs.ts
 */
import { copyFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
// sharp is installed per package (isolated linker); borrow packages/core's copy, the one the pipeline uses.
import sharp from '../../../packages/core/node_modules/sharp'

const ROOT = join(import.meta.dir, '../../..')
const OUT = join(import.meta.dir, '.out/inputs')

/** Deterministic pseudo-random numbers, so every run benches the same pixels. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

/** A photo-like RGB(A) buffer: soft light, a few objects with hard edges, fine texture and noise. */
function photo(width: number, height: number, seed: number, alpha = false): Buffer {
  const ch = alpha ? 4 : 3
  const buf = Buffer.alloc(width * height * ch)
  const rand = rng(seed)
  const blobs = Array.from({ length: 9 }, () => ({
    x: rand() * width,
    y: rand() * height,
    r: (0.05 + rand() * 0.2) * Math.min(width, height),
    c: [rand() * 255, rand() * 255, rand() * 255],
  }))
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width
      const v = y / height
      let r = 120 + 70 * Math.sin(u * 3.1 + v * 1.7) + 30 * Math.cos(v * 5.3)
      let g = 110 + 60 * Math.sin(v * 2.3 - u * 1.1) + 25 * Math.sin(u * 7.9)
      let b = 100 + 80 * Math.cos(u * 1.9 + v * 2.9)
      for (const o of blobs) {
        const dx = x - o.x
        const dy = y - o.y
        if (dx * dx + dy * dy < o.r * o.r) {
          const shade = 0.75 + 0.25 * Math.sin((dx + dy) / (o.r * 0.15))
          r = o.c[0] * shade
          g = o.c[1] * shade
          b = o.c[2] * shade
        }
      }
      const tex = 10 * Math.sin(x * 0.37) * Math.sin(y * 0.41)
      const i = (y * width + x) * ch
      buf[i] = Math.max(0, Math.min(255, r + tex + (rand() - 0.5) * 14))
      buf[i + 1] = Math.max(0, Math.min(255, g + tex + (rand() - 0.5) * 14))
      buf[i + 2] = Math.max(0, Math.min(255, b + tex + (rand() - 0.5) * 14))
      if (alpha) {
        const d = Math.hypot(u - 0.5, v - 0.5)
        buf[i + 3] = d < 0.4 ? 255 : d < 0.48 ? Math.round((255 * (0.48 - d)) / 0.08) : 0
      }
    }
  }
  return buf
}

await mkdir(OUT, { recursive: true })

const raw = (w: number, h: number, seed: number, alpha = false) =>
  sharp(photo(w, h, seed, alpha), { raw: { width: w, height: h, channels: alpha ? 4 : 3 } })

// A phone photo held upright: stored 4032x3024 with EXIF orientation 6 (rotate 90 CW).
await raw(4032, 3024, 1)
  .withMetadata({ orientation: 6 })
  .jpeg({ quality: 92 })
  .toFile(join(OUT, 'phone-12mp-rotated.jpg'))
// A DSLR photo, bigger than the 2560 cap on both edges.
await raw(6000, 4000, 2).jpeg({ quality: 92 }).toFile(join(OUT, 'dslr-24mp.jpg'))
// A typical square product shot.
await raw(1600, 1600, 3).jpeg({ quality: 90 }).toFile(join(OUT, 'product-1600.jpg'))
// A transparent PNG cut-out (master stays PNG, variants keep alpha).
await raw(1200, 1200, 4, true).png().toFile(join(OUT, 'cutout-alpha.png'))
// A small WebP under every standard width but one.
await raw(500, 375, 5).webp({ quality: 85 }).toFile(join(OUT, 'small-500.webp'))

// A small animated GIF (6 frames): becomes one animated WebP master, no variants.
const frames = await Promise.all(
  Array.from({ length: 6 }, (_, i) =>
    raw(320, 240, 10 + i)
      .png()
      .toBuffer(),
  ),
)
await sharp(frames, { join: { animated: true } })
  .gif({ delay: 120, loop: 0 })
  .toFile(join(OUT, 'animated.gif'))

// Two images already in the repo: a storefront screenshot (JPEG) and a section preview (WebP).
await copyFile(
  join(ROOT, 'docs/reviews/2026-10-29-storefront/pdp-preorder-koomerce.jpg'),
  join(OUT, 'repo-screenshot.jpg'),
)
await copyFile(
  join(ROOT, 'apps/admin/public/section-previews/LatestDrop.webp'),
  join(OUT, 'repo-preview.webp'),
)

console.log(`inputs written to ${OUT}`)
