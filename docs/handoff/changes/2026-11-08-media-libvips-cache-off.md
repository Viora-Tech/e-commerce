# libvips cache off in the image pipeline (8 Nov 2026)

`tuneImagePipeline` (packages/core/src/media/pipeline.ts) now calls `sharp.cache(false)` instead of a 100 MB cache. Each step starts a fresh `sharp()` from a new buffer, so the cache was almost never hit; it only kept decoded pixels resident after imports (about 50 MB less measured locally, same speed).
