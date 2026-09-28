# Security: harden theme section settings, Custom HTML and section links

**Hardening** (28 September 2026, no migration). Low-severity fixes from a security review:

- `migrateSectionSettings` (`packages/blocks/src/section-settings.ts`) now cleans stored values
  before render: `backgroundColor` must pass `safeColour` (else `''`), `anchorId` must match
  `/^[a-z][a-z0-9-]{0,40}$/i` (else `''`), and `colorScheme` (and the legacy `scheme`) must
  match the theme scheme id `/^[a-z0-9-]{1,40}$/` (else the default). `SectionFrame`'s legacy
  `scheme` path checks the same shape.
- `elementStyle` (`packages/blocks/src/element-style.ts`): text align only from
  left/center/right/justify, weight only a finite 100 to 900, table lookups use `Object.hasOwn`.
- Custom HTML (`embed-sanitize.ts`) no longer keeps `class` (storefront utilities such as
  `fixed inset-0` could cover the page). Docs updated.
- `sanitizeTemplateEmbeds` also sanitises the `fallback` of a Custom HTML `html` bound to a
  dynamic source.
- Section links (hero carousel, video hero, image banner, gallery, split hero, image with text,
  announcement bar, logo marquee, logo list, CTA banner, spotlight hero, section heading) render
  through `safeHref`. `safeHref`, dynamic-source `safeUrl` and admin `normalisePastedUrl` refuse
  `/\host` (a browser reads it as `//host`); `safeHref` also refuses control characters.
- `scripts/sweeps/dangerous-html.test.ts`: allow-list reasons corrected to match the code.

Not done: header/footer menu hrefs are not routed through `safeHref` here; binding a Custom HTML
`html` is not restricted by source kind (the storefront sanitises the resolved value anyway).
