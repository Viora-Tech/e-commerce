# Third-party notices

## invoicely (MIT)

The PDF templates in `src/templates/classic.tsx` and `src/templates/minimal.tsx`
are adapted from invoicely's `default` and `vercel` templates. The rupee
formatter in `src/money.ts`, the per-script font fallback in `src/pdf/fonts.ts`
and the admin live preview loop are adapted from invoicely's
`formatCurrencyText`, `resolve-pdf-font` and `invoice-preview`. The data model,
GST maths and numbering are our own.

Source: https://github.com/legions-developer/invoicely

```
MIT License

Copyright (c) 2025 Invoicely

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Fonts (SIL Open Font License 1.1)

Every font in `fonts/` is licensed under the SIL Open Font License, Version
1.1. The full licence text ships beside each family:

| Family | Files | Licence |
| --- | --- | --- |
| Inter | `fonts/inter/*.ttf` | `fonts/inter/OFL.txt` (Copyright 2020 The Inter Project Authors) |
| Geist | `fonts/geist/*.ttf` | `fonts/geist/OFL.txt` (Copyright 2024 The Geist Project Authors) |
| Noto Sans, Noto Sans Devanagari, Noto Sans SC | `fonts/noto/*.ttf` | `fonts/noto/OFL.txt` (Copyright 2022 The Noto Project Authors) |

Noto Sans SC was converted from WOFF2 to TTF without modifying its glyphs, so
react-pdf can embed it. The fonts are not sold on their own.
