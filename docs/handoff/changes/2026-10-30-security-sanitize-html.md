# Security: bump sanitize-html to 2.18.1 (XSS sanitizer)

`sanitize-html` is load-bearing for the storefront/admin XSS defense (C2): it sanitizes merchant
Custom HTML (`sanitizeEmbedHtml`), Puck rich text (`richtextHtml`) and the Customize canvas, all
rendered via `dangerouslySetInnerHTML` (every such sink is allow-listed by the `dangerous-html`
sweep). The installed `2.17.x` had known bypasses:

- GHSA-x3q4-9hxx-gx8m (moderate): `nonTextTags` discard region ends early on an implied close,
  letting `<noscript>` content render.
- GHSA-374f-7chj-9948 (low): SMIL animation namespace-prefix bypass → `javascript:` URI injection (XSS).
- GHSA-cv27-6wvh-8x7j (moderate): incomplete fix — `<meta http-equiv=refresh>` still shipped
  `javascript:`/`data:` URLs.

## Fix
- `@commerce/blocks`: `sanitize-html` `^2.17.0 → ^2.18.1` (latest; advisory range `<2.18.0`).

## Verification
- `bun audit` → `sanitize-html` advisories now **0**; resolved `sanitize-html@2.18.1`.
- `@commerce/blocks` sanitizer suites **70/70** (embed-sanitize, canvas-sanitize, richtext-html,
  lexical-html) — the XSS allow-lists still strip scripts/handlers/`javascript:` URIs after the bump.
- `bun run audit` gate green.
