# Umami follow-ups: Hindi and key rotation

Branch `feat/umami-hindi-rotation`.

- Hindi for the Umami app page and the Analytics page's Visitors section
  (`apps/admin/src/data/hi/umami.ts`). Both components now read their copy with `useCopy`;
  country names follow the admin language (`Intl.DisplayNames` with `hi-IN`).
- `bun run rotate-secrets` now re-encrypts encrypted values inside apps' own settings
  (`store.apps.settings.<app>`, at any depth): `rotateAppSettings` in
  `packages/core/src/secret-rotation.ts`, counted as `appSettings` and printed by the script.
  The install list and plain values are untouched; nothing moves when nothing is under an old key.
- Tests written (not run, owner rule): `rotateAppSettings` cases and the Umami key in the
  `rotateStoreSecrets` round trip (`packages/core/src/secret-rotation.test.ts`).
- Docs: developer Security ("Re-encrypt everything"), `docs/security/data-protection.md`, the
  Umami paragraph on the Plugins page.
