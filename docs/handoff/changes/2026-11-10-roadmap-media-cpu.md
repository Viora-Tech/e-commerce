# Roadmap: image processing must not starve the storefront (#1471)

Added step 0 to the Speed and memory track in `docs/roadmap.md`. Incident on 10 Nov 2026
09:08–09:25 UTC: a bulk photo upload ran `media-process` jobs of 30–74 s each on both cores (no
worker CPU limit; libvips threads from `availableParallelism()`), and each finished image cleared
the whole store's page cache. Both storefront health checks failed and replica 1 was killed. Full
evidence and the fix list are in #1471. Docs only; no code change here.
