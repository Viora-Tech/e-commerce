# Third-party licences: packages/blocks

## Magic UI (MIT)

Adapted patterns: Marquee, Number Ticker, Shine Border and Bento Grid, used in
`src/components/sections/logo-marquee.tsx`, `src/components/sections/testimonial-marquee.tsx`,
`src/components/sections/stats-counter.tsx`, `src/components/sections/cta-banner.tsx` and
`src/components/sections/bento-grid.tsx`. Each file carries a comment naming what it adapted.

Adapted components (source from the public shadcn registry, `https://magicui.design/r/<name>.json`,
read 2026-10-01): Marquee (`src/effects/marquee.tsx`), the 3D Marquee demo (`marquee-3d`,
`src/effects/marquee-3d.tsx`) and Safari (`src/effects/safari.tsx`), used by the Glide theme
sections (Reviews showcase and the phase 2 sections listed in `src/sections/sources.ts`).

Adapted components for the starter kit (source from the public shadcn registry via the Magic UI
MCP, read 2026-10-10): Retro Grid (`src/effects/retro-grid.tsx`, the CSS fallback only), Border
Beam (`src/effects/border-beam.tsx`), Word Rotate (`src/effects/word-rotate.tsx`) and Number
Ticker (`src/effects/number-ticker.tsx`, shared by `StatsCounter` and `StatsCards`), used by
`src/components/sections/kit/*`.

```
MIT License

Copyright (c) 2023 Magic UI

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

## Aceternity UI (free components)

Adapted components (source from Aceternity's public shadcn registry,
`https://ui.aceternity.com/registry/<name>.json`, free tier, read 2026-10-01): Lens
(`src/effects/lens.tsx`), 3D Card Effect (`src/effects/card-3d-container.tsx`), Meteors
(`src/effects/meteors.tsx`), Animated Tooltip (`src/effects/animated-tooltip.tsx`) and Focus Cards
(`src/effects/focus-cards.tsx`). Each file carries a comment naming what it adapted and what changed.

Licence: Aceternity UI publishes no separate licence file for its free components; its licence page
(https://ui.aceternity.com/licence, read 2026-10-01) allows unlimited end products ("End products may
be sold, licensed, sub-licensed, or freely distributed"; "You may modify, manipulate, and combine the
Item with other works") and forbids redistributing the items or their source files, and creating
themes, templates or derivative products to sell on a marketplace. Use inside our page builder, for
every merchant, closed source, is permitted in writing by Aceternity's founder (2026-09-23), recorded in
[`docs/licences/aceternity-pro.md`](../../docs/licences/aceternity-pro.md); the same conditions apply
(private repository, rendered only, credited in the Add panel via `src/sections/sources.ts`).

## Pattern-after sections (no code copied)

`SpotlightHero` (Aceternity UI), `SplitHero`, `VideoHero`, `FaqAccordion` and `Gallery`
(shadcnblocks) are our own implementations written from scratch after
studying the well-known public pattern — no source was copied, so no licence text is owed. They
carry a `Pattern after <source> <component>` comment for credit; see
[`docs/licences/aceternity-pro.md`](../../docs/licences/aceternity-pro.md),
[`docs/licences/magic-ui-pro.md`](../../docs/licences/magic-ui-pro.md) and
[`docs/licences/shadcnblocks.md`](../../docs/licences/shadcnblocks.md) for the builder-use
permission covering the Pro/paid tiers of these kits.
