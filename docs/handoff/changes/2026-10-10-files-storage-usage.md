# Files: storage usage and Documents tab

Branch `feat/files-storage-usage`. No migration.

- `mediaUsage` (`packages/core/src/media/usage.ts`, exported from core) and `media.usage` oRPC procedure: file count and bytes per type (images, videos, documents) over ready media, plus the largest files with product-use counts. `media.list` now accepts `fileType: 'document'` (anything that is not image/video). Tests in `packages/core/src/media/service.test.ts`.
- Content > Files: summary reads "86 files · 2.1 GB used", new Documents tab with count; counts and bytes refresh after uploads/deletes.
- Content > Files > Storage: new "Where your space goes" bar + "Largest files" table above the existing provider settings (`components/media/storage-usage.tsx`, `storage-largest-files.tsx`).
- No plan storage limit exists anywhere (`siteConfig.plans` only has orders per month, and `DEFAULT_STORAGE_QUOTA_BYTES` is a 20 GB safety ceiling, not a plan), so only "used" is shown, no "of 5 GB", no Free segment and no "Get more storage" button. Add them when billing defines storage per plan.
- Figma: Content / Files library (341:6563) and Content / Files / storage (341:11356). Not checked in a browser (Chrome extension not connected in this session).
