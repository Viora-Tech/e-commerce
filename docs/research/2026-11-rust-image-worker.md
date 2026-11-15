# Image processing in Rust: pilot G (11 Nov 2026)

Roadmap: speed track step 8 ("Go or Rust for self-contained services, starting with image
processing") and the Nov–Dec pilot in "Long-term port". Why it matters: on 10 Nov a photo upload
made Waimers take 8 s per page (#1471), with each image taking 30–74 s on both cores.

**Short answer:** for a merchant's own upload (the #1471 case), the Rust pipeline is 1.3–3.5x
faster on one core and needs a third of the memory. The files are the same set, at the same sizes,
and look the same. It is not ready to switch yet: AVIF quality needs one calibration pass, HEIC
and AVIF uploads are not decoded yet, and it has not run on the Linux server shape. Next step:
the three fixes below, a Linux build on the cloud builder, then shadow mode.

## What was built

`services/image-worker/` is a standalone Cargo workspace (no Bun workspace, no production
wiring):

- `image_worker::process_image(bytes, &Options) -> Processed` is a port of `processImage` with
  the same constants and the same results. The master is auto-oriented, has no metadata and its
  long edge is capped at 2560. A `image/jpeg` upload stays JPEG (mozjpeg q90); anything else
  becomes PNG (level 9, no filter). Each width in [320, 640, 1280, 1920] that fits gets an AVIF
  q55 and a WebP q72 (method 4) copy, and so does the master's own width. The ThumbHash is taken
  from a 100 x 100 fit-inside copy. An animated GIF becomes one animated WebP and gets no
  copies. The 40 MP bomb guard reads the header before any pixel is decoded. The bulk profile
  only changes AVIF effort.
- CLI: `image-worker process <input> --out <dir> [--profile bulk] [--content-type t]`. It writes
  files named exactly as `variantKey` names them and prints the `markMediaProcessed` fields as
  JSON.
- 16 tests (`cargo test --release -j 1`), case by case after `pipeline.test.ts`.
- Bench in `services/image-worker/bench/`: `make-inputs.ts` makes synthetic photo-like images at
  real upload sizes and copies two repo images, so no customer photos are used. `ts-process.ts`
  runs today's `processImage` tuned like the worker (`tuneImagePipeline({ cpus: 1, jobs: 1 })`).
  `run.ts` runs both through `measure`, a small helper crate that reports wall time, CPU time,
  cores used and peak RSS, and can pin a process to N cores. It then compares every output file
  with sharp.

### Crates chosen, and why

| Job | Crate | Licence | Why this one |
| --- | --- | --- | --- |
| Decode JPEG/PNG/WebP/GIF, EXIF orientation | `image` 0.25 (zune-jpeg, png, gif, image-webp) | MIT / Apache-2.0 | Pure Rust, widely used, reads only the header for the bomb guard |
| Resize | `fast_image_resize` 5 | MIT / Apache-2.0 | Pure Rust, AVX2/SSE4.1 SIMD, Lanczos3 like sharp, no extra copies, single thread |
| AVIF | `ravif` 0.13 on `rav1e` 0.8 | BSD-3 / BSD-2 | The only mature AVIF encoder in Rust. Built without threading, so it uses exactly one thread. libaom or SVT-AV1 bindings would need CMake and C++ in the build |
| WebP | `webp` 0.3 on libwebp (C, built by `cc`) | MIT/Apache, libwebp BSD-3 | No pure-Rust lossy WebP encoder is production-grade. It is the same libwebp sharp uses, so WebP output matches almost byte for byte |
| JPEG master | `mozjpeg` 0.10 (C, built by `cc`) | IJG + zlib + BSD-3 | The same mozjpeg sharp uses with `mozjpeg: true`, so masters match to ±0.2% |
| Placeholder | `thumbhash` 0.1 | MIT | Same author and algorithm as the npm package; the hashes match exactly (below) |

libvips bindings were not used: they would bring back the 17–20 MB native library and its own
thread pool, and they don't save memory. Two C libraries (libwebp, mozjpeg) are compiled from
source by the `cc` crate. They need a C compiler and `nasm` to build, and nothing at run time.
Credits are in `THIRD_PARTY_NOTICES.md`.

### Memory design

- The source is decoded once. It is shrunk to master size **before** the EXIF rotation, so the
  rotation only touches master-sized pixels. The full-size pixels are freed right after.
- Variants are resized from the master's pixels in memory. TS re-decodes its own JPEG-90
  master bytes instead.
- Widths are encoded one after another on one thread. Peak memory is about one master plus one
  encoder at a time.

## Measured results

Dev PC: Ryzen 5 7600, Windows 11. Best of 2 runs. "Pinned" means both processes were held to one
logical CPU, like the worker's single image core. Sizes are in KB and cover all widths. PSNR and
SSIM are of Rust's file against TS's file of the same name. "vs ref" is each file's PSNR against a
lossless reference (the source, auto-oriented and resized by sharp). A Bun + sharp process that
only starts and exits peaks at 38 MB, which is included in the TS RSS.

### Interactive profile (a merchant's own upload), pinned to 1 core

| Image | Input | Wall s TS / Rust | Peak RSS MB TS / Rust | Master KB | AVIF KB | WebP KB | Same files + dims | Min PSNR dB | Min SSIM | AVIF vs ref dB TS / Rust |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| phone-12mp-rotated.jpg | 4032x3024, EXIF 6 | **7.65 / 3.98** | **402 / 128** | 612 / 612 | 147 / 162 | 402 / 409 | yes | 37.3 | 0.926 | 40.3 / 38.4 |
| dslr-24mp.jpg | 6000x4000 | **6.68 / 5.25** | **443 / 122** | 586 / 585 | 160 / 191 | 447 / 477 | yes | 31.7 | 0.690 * | 36.1 / 38.3 |
| product-1600.jpg | 1600x1600 | **4.79 / 2.28** | **267 / 70** | 391 / 391 | 121 / 106 | 245 / 232 | yes | 35.2 | 0.918 | 38.9 / 37.2 |
| cutout-alpha.png | 1200x1200, alpha | **3.67 / 1.90** | **226 / 63** | 4609 / 4647 | 70 / 111 | 136 / 136 | yes | 37.0 | 0.966 | 39.2 / 37.7 |
| repo-screenshot.jpg | 1024x2216 | **2.45 / 1.37** | **212 / 62** | 107 / 107 | 91 / 84 | 106 / 108 | yes | 34.7 | 0.983 | 39.9 / 37.9 |
| small-500.webp | 500x375 | 0.59 / 0.17 | 67 / 13 | 344 / 350 | 14 / 9 | 21 / 21 | yes | 36.8 | 0.961 | 38.1 / 36.4 |
| repo-preview.webp | 512x332 | 0.27 / 0.09 | 68 / 12 | 17 / 17 | 3 / 3 | 3 / 3 | yes | 37.0 | 0.988 | 42.1 / 41.4 |
| animated.gif | 320x240, 6 frames | 0.13 / 0.05 | 44 / 9 | 41 / 41 | – | – | no ** | 37.4 | 0.989 | – |

### Interactive profile, cores not capped (as production runs today)

The worker container has no CPU limit. sharp runs one libvips thread, but the interactive
profile starts every width at once on Bun's own threads, so TS used 1.6–2.4 cores. Rust stays on
one core.

| Image | Wall s TS / Rust | Cores TS / Rust | Peak RSS MB TS / Rust |
| --- | --- | --- | --- |
| phone-12mp-rotated.jpg | 3.34 / 3.48 | 1.95 / 0.99 | 444 / 128 |
| dslr-24mp.jpg | 3.08 / 4.73 | 2.40 / 0.99 | 507 / 122 |
| product-1600.jpg | 2.16 / 2.14 | 2.15 / 1.00 | 307 / 70 |
| cutout-alpha.png | 2.30 / 1.76 | 1.62 / 0.98 | 244 / 62 |

TS is only as fast as Rust here because it takes two cores, and the second core is the one the
storefront needs (#1471). Its peak of 444–507 MB is also **above the worker's
`mem_limit: 384m`** (`deploy/docker-compose.prod.yml`). Even without the rest of the worker, a
12 MP phone photo can push the container to its memory limit today.

### Bulk profile (imports, backlogs), pinned to 1 core

| Image | Wall s TS / Rust | Peak RSS MB TS / Rust | AVIF KB TS / Rust | AVIF vs ref dB TS / Rust |
| --- | --- | --- | --- | --- |
| phone-12mp-rotated.jpg | 2.36 / 3.70 | 240 / 129 | 305 / 167 | 39.3 / 38.2 |
| dslr-24mp.jpg | 2.26 / 4.79 | 238 / 123 | 303 / 197 | 36.0 / 38.2 |
| product-1600.jpg | 1.62 / 2.02 | 165 / 70 | 278 / 110 | 38.4 / 37.1 |
| cutout-alpha.png | 1.21 / 1.47 | 176 / 62 | 117 / 110 | 38.4 / 37.6 |
| repo-screenshot.jpg | 0.76 / 1.17 | 136 / 62 | 96 / 85 | 39.3 / 37.9 |

In bulk, TS is faster, but its effort-2 AVIF files are 1.6–2.5x bigger. Rust's mapping (rav1e
speed 8) keeps them small. At rav1e speed 10, Rust does the 24 MP photo in 2.18 s with 220 KB of
AVIF: as fast as TS bulk, with files a quarter smaller. Bulk should map to speed 10.

\* The 1280 copy of the 24 MP photo: TS's own file is 31.5 dB from the reference and Rust's is
35.3 dB, so the gap is in TS. sharp's exact 2x downscale aliases the fine synthetic texture.
Every other file pair is at least 34.5 dB and SSIM 0.91 or more.

\** TS records the animated GIF as 320 x **1440** (all six frames stacked), because
`processAnimatedGif` reads `meta.height` from `sharp(..., { animated: true })`. Rust records
320 x 240, which is correct. The WebP files themselves match (37.4 dB). This is a TS bug that
needs its own issue.

**ThumbHash:** identical strings from TS and Rust for every image.

### What the numbers say

- **Speed, per core:** Rust is 1.3–3.5x faster for interactive uploads. Most of Rust's time is
  AVIF: on the 24 MP photo, rav1e takes about 3.5 of the 5.0 s at speed 6, 2.2 s at speed 8 and
  0.8 s at speed 10.
- **Memory:** Rust needs about 3–4x less: 122–129 MB for 12–24 MP photos against 400–500 MB.
  This holds in every mode and does not depend on encoder settings.
- **Output:** same files, names and dimensions (the GIF bug aside). Masters and WebP are within
  ±1% in bytes (same mozjpeg and libwebp). AVIF at the same nominal quality 55 comes out about
  1.5–2 dB lower than libaom on most images. ravif's quality scale is not libheif's, and ravif
  always encodes 4:4:4 chroma.

### Build

| | Value |
| --- | --- |
| Cold release build, `-j 1`, LTO off, 16 codegen units | 7 min 42 s, peak RSS 466 MB across all processes (502 MB committed) |
| Rebuild after a profile change (deps compiled again, registry warm) | 4 min 11 s, peak 466 MB |
| `cargo test --release -j 1` after a build | 8 s, peak 251 MB |
| Binary (Windows x64, stripped) | 9.5 MB with libwebp and mozjpeg linked in statically (9.0 MB with `panic = "abort"`, which was dropped so that mozjpeg's error panics can be caught) |

## How it would plug in later

**Option A: the worker calls the binary (recommended first).** `media-process.ts` keeps the
queue, the database and storage. It writes the object to a temp file and runs
`image-worker process <tmp> --out <dir> --content-type <row type> --profile <p> --key <key>`,
reads `result.json`, and puts the files where it puts them today. Exit code 3 becomes
`DecompressionBombError`. Nothing changes in BullMQ, `fairProcessor`, retries or the
`failed`-row handling. The image work runs in its own short-lived process, so its memory is
returned to the system after each image and the Bun heap never holds decoded pixels. The only
cost is one process start per image (about 5 ms) and temp files.

**Option B: a small Rust job runner on the same queue.** Rust reads the `media-process` BullMQ
queue from Dragonfly, talks to Postgres (SQLx, with the per-store RLS `withStore` sets) and to
storage (S3 and local providers, plus the per-store storage settings and their secret). That
means porting `storageForStore`, `registriesForStore`, `markMediaProcessed` and BullMQ's job
protocol (Lua scripts). It is a lot more surface for little extra gain over A. It belongs to the
Feb 2027 "worker jobs in Rust" step, once the Rust skeleton has a queue client and SQLx.

**Build.** Built on the cloud builder, never the dev PC: target `x86_64-unknown-linux-musl`, so
the binary is static and runs in the existing `oven/bun:*-alpine` worker image. The builder
needs `build-base` and `nasm`. Use a multi-stage Dockerfile, with a `cargo-chef` layer to cache
the dependency build. Expect the image to grow by about 9–10 MB while both pipelines ship, and
to shrink by 17–20 MB (sharp and libvips) once sharp leaves the worker. sharp stays in the
storefront and admin only if they still use it.

**Rollout.**

1. Shadow mode: the worker still writes TS's files. It also runs the binary on the same bytes
   into a temp dir, logs wall time, peak RSS, byte sizes, dimensions and the ThumbHash match,
   and deletes the shadow output. Behind `MEDIA_RUST_SHADOW=1`, on dev (vioratech.in) first.
2. Compare a week of uploads: dimensions equal on 100%, sizes within ±25%, no Rust errors on
   input TS accepted (HEIC and AVIF must be ported first).
3. Switch with `MEDIA_PIPELINE=rust`; TS stays as a one-env-var fallback for one release.
4. Then remove sharp from the worker and lower `mem_limit`.

## Before switching

1. **AVIF calibration:** choose the ravif quality that matches libaom q55 on PSNR and bytes
   (probably 60–65), and map bulk to rav1e speed 10. Re-run the bench.
2. **HEIC and AVIF uploads:** decode with `libheif-rs` and dav1d. These are C libraries, built on
   the cloud builder. Until then, refused inputs could fall back to the TS path.
3. **ICC profiles:** convert embedded profiles (iPhone Display P3) to sRGB with `moxcms` (pure
   Rust, BSD-3/Apache) instead of dropping them. sharp converts them today.
4. Port `encodeVariantWidth` (the backfill's single-width path).
5. Re-run the bench on the real server shape (2 vCPU Linux, inside the worker container's
   384 MB limit).

Something to do today without Rust: TS's interactive profile encodes all widths at once, which
is what puts it at 400–500 MB. Running interactive uploads one width at a time, as bulk already
does, would bring TS under the worker's 384 MB limit at once (bulk pinned peaks at 136–240 MB).
