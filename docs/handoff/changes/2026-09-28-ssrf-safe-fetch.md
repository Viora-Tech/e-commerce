# SSRF-safe fetch for imported media and Truecaller

**SSRF-safe fetch** (28 September 2026, security fix, no migration). New
`@commerce/core/safe-fetch` (`packages/core/src/net/safe-fetch.ts`): `safeFetch(url, opts)` GETs
an untrusted URL only over https (http when `allowHttp`), refuses when any address the host
resolves to (or an IP literal) is private, loopback, link-local/metadata (169.254/16), CGNAT,
multicast, reserved, or an IPv6 form of those (`::ffff:` mapped, NAT64, 6to4, ULA, fe80::),
follows at most 3 redirects by hand re-checking each `Location`, and times out; `readCapped`
reads a body chunk by chunk and gives up (null) past a byte cap, with or without
`content-length`. `fetch` and `lookup` are injectable; DNS rebinding between check and connect
is a documented, accepted residual risk.

The Shopify importer's media re-hosting (`packages/plugin-shopify-import/src/media.ts`) now
downloads through it (http allowed for old merchant CSVs) and no longer trusts the URL
extension: when the response's own type is not an accepted media type it sniffs magic bytes and
refuses anything that is not jpeg/png/gif/webp/avif/mp4. `RunDeps`/`MediaHostOptions` take a
`lookup` (test helpers inject a fake public address, so DB tests do no real DNS).

Truecaller's profile fetch (`completeTruecaller`) now sends `redirect: 'error'`, a 5 s timeout
and reads at most 64 KB; the truecaller.com host allow-list is unchanged.
