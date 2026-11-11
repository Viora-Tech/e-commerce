# image-worker (Rust pilot)

The upload-time image pipeline (`packages/core/src/media/pipeline.ts`) ported to Rust, for
roadmap pilot G. **Not used in production.** Design note and results:
`docs/research/2026-11-rust-image-worker.md`.

## Build and test

Needs Rust (stable), a C compiler (libwebp and mozjpeg are C) and `nasm` (rav1e and mozjpeg
assembly). On a small machine keep it to one job:

```sh
cd services/image-worker
CARGO_PROFILE_RELEASE_LTO=false cargo build --release -j 1
cargo test --release -j 1
```

## Use

```sh
target/release/image-worker process photo.jpg --out out/ [--profile bulk] [--content-type image/jpeg]
```

Writes `out/photo.jpg` (cleaned master), `out/photo-w320.avif`, `out/photo-w320.webp`, ... and
`out/result.json` (width, height, thumbhash, animated, file keys and sizes). Exit code 3 means a
decompression bomb, 4 an unsupported format.

## Compare with the TypeScript pipeline

Needs `bun install` at the repo root (sharp comes from `packages/core`).

```sh
bun services/image-worker/bench/make-inputs.ts           # sample inputs, synthetic + repo images
bun services/image-worker/bench/run.ts                   # cores not capped, as in production
bun services/image-worker/bench/run.ts --cpus 1          # both pinned to one core
bun services/image-worker/bench/run.ts --profile bulk --cpus 1
```

Results go to `bench/.out/results-<mode>.md` and `.json` (git-ignored). `bench/measure` is a small
helper that runs a command and reports wall time, CPU time, cores used and peak RSS (Windows
job object; `getrusage` on Linux).
