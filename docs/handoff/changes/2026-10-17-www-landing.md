# apps/www: marketing site

New Next.js app `apps/www` (port 3300) built from the Figma "Landing (www)" page: home, pricing,
features, changelog, about, contact, security, 404, six legal pages (template text), waitlist
modal and thank-you page, cookie banner and preferences.

- Waitlist, changelog subscribe and contact forms are stubs (`TODO(owner)`): they validate and
  report success, nothing is stored. A public, rate-limited `joinWaitlist` endpoint is still needed.
- Orange (`--color-cta`) is used only on primary CTAs, the "Most popular" plan and the tour progress line.
- Placeholders left in copy: prices, legal brackets, founder note, Waimers quote, contact phone/booking link.
