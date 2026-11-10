# Admin CSP allows WebAssembly (GST invoices preview)

- Fixes #1484. GST invoices › Settings showed "The preview could not be drawn" on the live
  admin. The browser refused the PDF renderer's WebAssembly module: the production CSP had no
  `'wasm-unsafe-eval'`. Development only reports CSP, so it never showed locally.
- `apps/admin/src/lib/csp.ts`: `script-src` gains `'wasm-unsafe-eval'` (WebAssembly only; JS
  `eval` stays blocked). `csp.test.ts` checks both.
- Checked: `vitest run src/lib/csp.test.ts` (7 pass), biome on both files.
