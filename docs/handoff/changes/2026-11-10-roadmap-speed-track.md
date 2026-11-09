# Roadmap: speed and memory track

Added a "Speed and memory track" to `docs/roadmap.md`: edge cache, image originals, server query
time, plain HTML for products and collections, one storefront copy, a measured storefront-server
comparison (Next vs Bun/Hono vs Rust vs edge cache), admin as a browser-only app, and Go/Rust for
self-contained services. Owner's goal (10 Nov): fastest experience and least memory; a rewrite is
acceptable when measurements win.

Also the long-term port: Rust backend, worker and storefront renderer, React admin (SolidJS only if
a pilot wins), moved one piece at a time behind the same API paths with shadow comparison; target
release April 2027, monthly milestones from Nov 2026.
