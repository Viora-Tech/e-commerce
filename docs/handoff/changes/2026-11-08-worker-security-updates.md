# Security updates from the image scan (8 Nov 2026)

The image scan listed 12 open warnings on the worker (4 high).

## Fixed
- **happy-dom → 21.0.4** (root `overrides`; pulled in by @puckeditor/core and @tiptap/html). Covers CVE-2026-115895 (high), CVE-2026-118660 (high) and CVE-2026-118661.
- **source-map-js → 1.2.2** (override). CVE-2026-93749 (high).
- **follow-redirects → 1.16.2** (existing override bumped). CVE-2026-116689.
- **hono → ^4.13.17** (worker). CVE-2026-109955.
- **Alpine OS packages** (musl, zlib): `apk upgrade` in the runtime stage of all three images. ALPINE-CVE-2026-107891 (high), ALPINE-CVE-2026-4738 and ALPINE-CVE-2026-85091.

## Left open, on purpose
- **glob 13 → 14, minimatch 10 → 11.** The fixes are only in new major versions, and the packages that use them (mjml-cli, js-beautify, the Sentry bundler plugin) require 13/10. They only ever see our own fixed patterns, never user input. Revisit when those packages move up.
- **deepmerge 4.3.1** (via html-to-text). No fixed version is published, and it only merges our own options objects.
