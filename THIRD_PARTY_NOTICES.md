# Third-party notices

Code, templates and assets adapted from other projects, with their licences. Every package
that adapts outside work keeps the full licence text next to it; this file is the index.

| Project | Licence | What we adapted | Where | Full notice |
| --- | --- | --- | --- | --- |
| [invoicely](https://github.com/legions-developer/invoicely) | MIT, used with the author's permission | PDF invoice templates (`default`, `vercel`), rupee formatter, per-script font fallback, live preview loop | `packages/invoices` | [`packages/invoices/THIRD_PARTY_LICENSES.md`](packages/invoices/THIRD_PARTY_LICENSES.md) |
| Inter, Geist, Noto Sans (+ Devanagari, SC) | SIL Open Font License 1.1 | Fonts embedded in invoice PDFs | `packages/invoices/fonts` | `OFL.txt` beside each family |

Libraries installed from npm are not listed here; their licences ship inside `node_modules`.

## Adding an entry

Before copying or closely adapting code from another project:

1. **Check the licence.** MIT, BSD and Apache 2.0 may be adapted. GPL, AGPL, SSPL, BSL, FSL and
   "fair-code" licences (for example n8n's) may not: learn from the design, don't copy the code.
2. **Keep the notice.** Put the project's copyright line and full licence text in a
   `THIRD_PARTY_LICENSES.md` in the package that uses it, saying which files were adapted.
3. **Mark the files.** A short comment at the top of each adapted file: what it came from and
   the licence, e.g. `Adapted from invoicely's formatCurrencyText (MIT).`
4. **Add a row above.**
