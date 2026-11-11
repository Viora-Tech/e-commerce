# Rust image worker pilot (2026-11-11)

Roadmap pilot G (speed track step 8, and the "Nov–Dec 2026" pilot in the long-term port). Draft
PR into `dev`, branch `pilot/rust-image-worker`. **Nothing in production changed**: the worker
still runs `packages/core/src/media/pipeline.ts`.

- `services/image-worker/`: a standalone Cargo workspace (not a Bun workspace). Library
  `image_worker::process_image` plus the CLI `image-worker process <input> --out <dir>
  [--content-type t] [--profile interactive|bulk] [--avif-speed 1-10] [--key name]`. It writes
  the same files as `processImage` with the same names (master keeps its key, variants
  `name-w640.avif`/`.webp`, animated GIF -> `name.webp`) and prints the fields
  `markMediaProcessed` needs as JSON (also `result.json`). Exit codes: 3 bomb, 4 unsupported.
- Crates: `image` (decode), `fast_image_resize` (Lanczos3), `ravif`/`rav1e` (AVIF, built without
  threading), `webp`/libwebp (WebP), `mozjpeg` (JPEG master), `thumbhash`. Licences in
  `THIRD_PARTY_NOTICES.md`. The build needs a C compiler (MSVC Build Tools here; `build-essential`
  in Docker) and `nasm` for the rav1e/mozjpeg assembly.
- Not yet ported: HEIC and AVIF **inputs** (refused with exit 4), ICC profile conversion to sRGB
  (profiles are dropped), `encodeVariantWidth` (the backfill's single-width path).
- Bench: `services/image-worker/bench/` (`make-inputs.ts`, `ts-process.ts`, `run.ts`, and the
  `measure` helper crate). See `services/image-worker/README.md` and the results in
  `docs/research/2026-11-rust-image-worker.md`.
- Tests: `cargo test --release -j 1` in `services/image-worker` (mirrors `pipeline.test.ts`).
- Build on the dev PC only with `-j 1`; production builds belong on the cloud builder.

Found on the way (not fixed here): the TS pipeline stores an animated GIF's height as all frames
stacked (a 320 x 240, 6-frame GIF is recorded as 320 x 1440), because `processAnimatedGif`
reads `meta.height` from `sharp(..., { animated: true })`; it should use `meta.pageHeight`. Needs a
`bug` issue (the agent could not create one).
