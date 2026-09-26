# Third-party notices

Code, templates and assets adapted from other projects, with their licences. Every package
that adapts outside work keeps the full licence text next to it; this file is the index.

| Project | Licence | What we adapted | Where | Full notice |
| --- | --- | --- | --- | --- |
| [invoicely](https://github.com/legions-developer/invoicely) | MIT, used with the author's permission | PDF invoice templates (`default`, `vercel`), rupee formatter, per-script font fallback, live preview loop | `packages/invoices` | [`packages/invoices/THIRD_PARTY_LICENSES.md`](packages/invoices/THIRD_PARTY_LICENSES.md) |
| [Saleor Dashboard](https://github.com/saleor/saleor-dashboard) | BSD 3-Clause | Admin layout patterns (top nav, list filter bar, datagrid density and pager, card anatomy, detail main + side layout), re-implemented on our shadcn/Base UI | `apps/admin/src/components/layout`, `apps/admin/src/components/table` | [`apps/admin/THIRD_PARTY_LICENSES.md`](apps/admin/THIRD_PARTY_LICENSES.md) |
| [Macaw UI](https://github.com/saleor/macaw-ui) | CC BY 4.0 | Theme token values (neutral palette, borders, overlay shadows, type steps), modified | `packages/ui/src/styles.css` | [`apps/admin/THIRD_PARTY_LICENSES.md`](apps/admin/THIRD_PARTY_LICENSES.md) |
| Inter, Geist, Noto Sans (+ Devanagari, SC) | SIL Open Font License 1.1 | Fonts embedded in invoice PDFs | `packages/invoices/fonts` | `OFL.txt` beside each family |
| [cobe](https://github.com/shuding/cobe) | MIT | Dotted 3D WebGL globe (no borders) that renders the Home card and the Live view page, patched with a detailed land map (`patches/cobe@2.0.1.patch`) | `apps/admin/src/components/analytics/live-globe` | [`apps/admin/THIRD_PARTY_LICENSES.md`](apps/admin/THIRD_PARTY_LICENSES.md) |
| [Natural Earth](https://www.naturalearthdata.com/) 1:50m land | Public domain | Rasterised to the 2048×1024 land map in the cobe patch, so India and Sri Lanka read correctly | `patches/cobe@2.0.1.patch` | Public domain, credited as "Made with Natural Earth" |

Paid UI kits: Aceternity UI Pro may be used in builder blocks under the owner's written permission, see [`docs/licences/aceternity-pro.md`](docs/licences/aceternity-pro.md).

Libraries installed from npm are not listed here; their licences ship inside `node_modules`.
Framework credit, not an adaptation: `apps/docs` (the docs site) is built with
[Nextra](https://github.com/shuding/nextra) (MIT), verified on
[npm](https://www.npmjs.com/package/nextra) and its
[GitHub `LICENSE`](https://github.com/shuding/nextra/blob/main/LICENSE); its footer credits
Nextra too.

## Adding an entry

Before copying or closely adapting code from another project:

1. **Check the licence.** MIT, BSD and Apache 2.0 may be adapted. GPL, AGPL, SSPL, BSL, FSL and
   "fair-code" licences (for example n8n's) may not: learn from the design, don't copy the code.
2. **Keep the notice.** Put the project's copyright line and full licence text in a
   `THIRD_PARTY_LICENSES.md` in the package that uses it, saying which files were adapted.
3. **Mark the files.** A short comment at the top of each adapted file: what it came from and
   the licence, e.g. `Adapted from invoicely's formatCurrencyText (MIT).`
4. **Add a row above.**

Candidate projects, with verified licences and what to take from each: [`docs/open-source-radar.md`](docs/open-source-radar.md).

## @theguild/remark-mermaid

- Used in: `apps/docs` (renders Mermaid diagrams in MDX pages)
- Licence: MIT — https://github.com/dimaMachina/nextra (The Guild)
