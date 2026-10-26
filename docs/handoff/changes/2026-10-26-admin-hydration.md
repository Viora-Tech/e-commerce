# Admin hydration error #418 and the `parentNode` crash (2026-10-26)

Bug reports from admin.koomerce.app (#795, #674, #673, #672, #671, #665) all carried
`Minified React error #418 args[]=text` and often
`TypeError: Cannot read properties of null (reading 'parentNode')` at `<page>:2:<col>`.

## Root cause

Cloudflare's zone-wide **Email Address Obfuscation** (Scrape Shield) is on for `koomerce.app`
(confirmed live: the storefront contact page comes back with
`<span class="__cf_email__" data-cfemail="…">[email&#160;protected]</span>` and an injected
`/cdn-cgi/scripts/…/email-decode.min.js`).

- The admin renders emails as page text: the sidebar's user row (`admin-sidebar.tsx`,
  `{user.email}`) on **every** page, plus customer and order emails in lists and detail pages.
- Cloudflare rewrites them to `[email protected]`. The decoder script has no nonce, so the
  admin's CSP (`nonce` + `strict-dynamic`, `lib/csp.ts`) blocks it.
- React hydrates, finds "[email protected]" where it rendered the address, and throws #418
  ("text"). The sidebar sits outside any Suspense boundary, so React drops the server HTML
  and redraws the whole document.
- HTML still streaming in then runs React's inline `$RS` / `$RC` scripts (document line 2),
  whose placeholders React already removed: `null.parentNode`.

Dates were checked as well: every admin date goes through `formatInZone` (pinned to
Asia/Kolkata and en-IN), and the Node 22.23.4 image formats en-IN the same as Chrome (ICU 78,
plain spaces). They were not the cause.

## Fix

`apps/admin/src/proxy.ts` sends `Cache-Control: private, no-cache, no-store, max-age=0,
must-revalidate, no-transform` (`PAGE_CACHE_CONTROL` in `lib/csp.ts`) on every page response.
That is Next's own dynamic-page value plus `no-transform`. Cloudflare doesn't obfuscate emails
in a `no-transform` response, and Next keeps a Cache-Control the proxy already set.
`csp.test.ts` covers it.

Side effect: Cloudflare doesn't re-compress these HTML responses. Next's standalone server
already gzips them (`compress` defaults to on).

## Still open

- Turning Email Obfuscation off for `admin.koomerce.app` in Cloudflare with a Configuration
  Rule would also work and needs no deploy. It's a zone change for the owner to make.
- The storefront has the same problem wherever a React component (not theme HTML) shows an
  email (account and order pages). Its pages are cached (`s-maxage`), so it needs its own
  fix: a Configuration Rule, or `no-transform` added to its existing Cache-Control.
- `components/discounts/form-state.ts` `toLocalInput` reads the runtime's own time zone,
  which is UTC on the server. It only fills a `datetime-local` value attribute, which
  doesn't fail hydration, but it is a time-zone bug for the discount/draft owners to fix.
