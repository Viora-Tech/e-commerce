# Untested app badge and docs/roadmap.md (2026-11-07)

- New optional `tested` on an app's manifest (`packages/plugins/src/types.ts`), carried to the
  admin as `AppSummary.tested`. Only Delhivery and Razorpay set it; every other app shows an
  "Untested" chip on its listing and in Installed apps. Set `tested: true` once an app has been
  run end to end on a live store.
- `docs/roadmap.md` started: app UI redesign, untested apps, one store for physical, digital,
  subscription and course sellers, bulk shipments redesign, store credit.
