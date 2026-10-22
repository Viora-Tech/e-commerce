# Node.js security update (CVE-2026-111497)

- The admin and storefront images now take Node from the official `node:22.23.4-alpine` image
  (`COPY --from=… /usr/local/bin/node`) instead of Alpine's `nodejs` package, in both the build
  and runtime stages. Alpine's package still served 22.23.2 after the 2026-10-21 Node security
  release (Brotli decoder out-of-bounds write, plus TLS hostname-verification fixes).
- The official binary has full ICU, so `icu-data-full` is no longer installed; en-IN / hi-IN
  formatting is unchanged (checked: `12,34,567`, `जनवरी`).
- The worker runs on Bun and is not affected.
- To bump Node later: change the `node:<version>-alpine` tag in both Dockerfiles (two lines each).
- Advisory: https://vercel.com/kb/bulletin/node-js-security-advisory
