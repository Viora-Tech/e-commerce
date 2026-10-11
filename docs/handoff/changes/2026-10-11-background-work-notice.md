# Worker CPU cap and the "store may be slower" notice (2026-10-11)

Second half of the storefront speed work (the render cache is `2026-10-11-storefront-speed.md`).
In production the worker held 200% of the box's two vCPUs during an image backlog, and store pages
slowed to 3 to 5 s.

- **CPU cap**: recommended Dokploy values (worker CPU limit `1000000000` = 1 CPU; reservations for
  storefront, admin, Postgres) and `MEDIA_PROCESS_CONCURRENCY=1` on a 2-vCPU box, in developer docs
  Deployment → "CPU for the worker". `deploy/docker-compose.prod.yml` caps the worker at
  `cpus: 1.0`. Production itself is not changed: the owner applies the Dokploy values.
- **Notice**: `components/media/background-work-notice.tsx` (Home, Content → Files, the Shopify
  importer's list and run pages) polls `media.backgroundWork` every 30 s and shows "Processing N
  images in the background: your store may be a little slower until it finishes (about X min)"
  while more than 50 images are `processing` or a real import runs. Core
  `media/background-work.ts` (`mediaBacklog`, `backgroundWork`), plugin `importInProgress`. Copy
  `data/background-work.ts` + Hindi.
- Docs: developer `media-pipeline` ("Keeping the shop fast while images process"), `deployment`;
  merchant guide `content/files-and-storage` ("When images are still processing").
