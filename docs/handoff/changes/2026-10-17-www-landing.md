# apps/www: marketing site

New Next.js app `apps/www` (port 3300) built from the Figma "Landing (www)" page: home, pricing,
features, changelog, about, contact, security, 404, six legal pages (template text), waitlist
modal and thank-you page, cookie banner and preferences.

- Waitlist, changelog subscribe and contact forms are stubs (`TODO(owner)`): they validate and
  report success, nothing is stored. A public, rate-limited `joinWaitlist` endpoint is still needed.
- Orange (`--color-cta`) is used only on primary CTAs, the "Most popular" plan and the tour progress line.
- Placeholders left in copy: prices, legal brackets, founder note, Waimers quote, contact phone/booking link.

## Shared globe
The dependency-free WebGL globe renderer, controls and projection moved from
`apps/admin/.../live-globe` to `packages/ui/src/globe` (`@commerce/ui/globe/*`), with their tests and the
WebGL support check. The admin imports them from there; its data hooks, settings, palette and copy stay
in the admin. `apps/www` uses the same renderer for the hero globe (drag with inertia, slow auto-rotate
that resumes after 3 s, ctrl/pinch zoom, DEMO order pins and chips from `data/demo-orders.ts`).
