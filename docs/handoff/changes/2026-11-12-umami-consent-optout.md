# Umami: a "no" on the cookie banner stops the tracker at once (12 Nov 2026)

Issue #1592. Found in the Phase 1b group 2 apps audit
(`docs/audits/2026-11-12-apps-group-2.md`).

- Umami's tracker counts client-side page views itself once loaded; removing its `<script>`
  does not stop it. A shopper who said no (or changed a yes to a no) kept being counted until a
  full reload.
- New `syncUmamiOptOut` in `packages/plugin-umami/src/tracker.ts` sets Umami's own off switch
  (`umami.disabled` in local storage, read by the tracker before every send) when Umami is not
  allowed, and clears it when it is. A value the merchant set themselves (to leave out their own
  visits) is never cleared. Storage that throws is ignored.
- `apps/storefront/src/components/privacy/consent-manager.tsx` calls it whenever the consent or
  the tracker changes.
- Test: `packages/plugin-umami/test/tracker.test.ts`.
