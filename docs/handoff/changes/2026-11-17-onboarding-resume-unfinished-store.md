# Half-made store goes back to onboarding (#1778)

**What:** if `createStore`'s last step fails (roles, owner, theme, market, shipping, apps), the store and its organization stayed, and the owner could open its admin pages, which all failed. Now the admin layout sends the owner of such a store to `/onboarding`, and the wizard opens with that store's name and address filled in plus a note, so finishing picks up the same store (`createStore` resumes by owner + address).

**How it knows:** that last step is one transaction, so a store with no theme never finished. Only stores `createStore` made count (id derived from owner + address), so stores made any other way are never sent back. Staff (non-owners) are never redirected.

**Files:** `packages/core/src/onboarding/unfinished.ts`, `apps/admin/src/app/(admin)/layout.tsx`, `apps/admin/src/app/onboarding/page.tsx`, `apps/admin/src/components/onboarding/onboarding-wizard.tsx`, copy in `data/onboarding.ts` (+ Hindi).

**Cost:** one membership lookup and two small reads per admin page load.

**Checked:** locally, an account whose store creation had failed (missing local migration) now lands on onboarding with the name filled in.
