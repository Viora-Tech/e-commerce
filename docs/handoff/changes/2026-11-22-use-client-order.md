# Admin build: "use client" back on line 1

**What:** b0e6dfc85 (errorText refactor) inserted its import above `'use client'` in
`provider-connect-page.tsx`, `use-label-sheet.ts` and `use-manifest-sheet.ts`, and the formatter
then turned the directive into a plain expression `;('use client')`. Typecheck and tests pass, but
the Next build refuses it ("The 'use client' directive must be placed before other expressions"),
so the 22 Nov evening admin image failed to build. The directive is first again.

**Check:** `grep -rlE "^;\('use client'\)" apps packages` finds none.
