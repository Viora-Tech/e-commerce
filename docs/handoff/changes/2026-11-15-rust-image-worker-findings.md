# Rust image worker pilot: findings kept, code not adopted

The pilot in #1542 (a standalone Rust image worker under `services/image-worker`, never wired in)
was closed on 15 Nov 2026 by the owner's decision: no Rust toolchain in the images for now.
Its research write-up is kept at `docs/research/2026-11-rust-image-worker.md`; the code stays on
the closed branch `pilot/rust-image-worker` if the idea is picked up again. Production still
processes media with `packages/core/src/media/pipeline.ts`.
