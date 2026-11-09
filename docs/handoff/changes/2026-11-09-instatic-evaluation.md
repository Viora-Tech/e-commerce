# Instatic evaluated as page builder: keep Puck, copy its publishing (9 Nov 2026)

This PR is docs only (issue #1368). No code in the product changed.

## Where things are

- Report: `docs/research/2026-11-instatic-evaluation.md`.
- Plugin and page code: `docs/research/instatic-plugin/`. It is not imported anywhere; run it
  inside an Instatic checkout (see its README).
- `docs/open-source-radar.md`: the Instatic row now says "ideas only" and links the report.

## Result

**Recommendation: C. Keep Puck and copy Instatic's publishing approach.** That means bake on
publish, auto-detected holes and a runtime of about 1 KB. This becomes phase 5 of
`docs/design/storefront-plain-html.md`, estimated at 3-4 weeks.

Why Instatic itself does not fit today:
- one site per server;
- its own login, with no SSO;
- its admin sends `X-Frame-Options: DENY`;
- its SEO head is only title, description and `lang`;
- one maintainer wrote 93 % of the commits.

## Measured page

The Instatic page was served locally:
- HTML 9 KB (2.5 KB gzip), CSS 6.4 KB, JS 2.5 KB.
- 17 requests, 118 KB in total.
- Lighthouse mobile 100 on both runs: LCP 1.75 s, TBT 0.

The live Waimers home on 9 Nov scored 45, with LCP 9.6 s and 12.1 MB. This is not a like-for-like
comparison; the report explains why.

## Left undone

- The upstream bug was not reported. A module used only inside a loop loses its CSS and JS on
  the published page (`server/publish/siteModuleAssets.ts`). The repro is in the report.
- The local eval setup is outside the repo and can be deleted:
  - `E:/Viora-Tech/eval/instatic` (clone, SQLite at `.tmp/dev.db`, test owner `eval@koomerce.test`);
  - `E:/Viora-Tech/eval/work`.
