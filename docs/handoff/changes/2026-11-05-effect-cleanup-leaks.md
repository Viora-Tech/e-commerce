# Two small leaks closed

React Doctor's `effect-needs-cleanup` named 17 places. Each was read by hand: two leaks are real, and the rest were false alarms.

- `packages/ui/.../shadcn/carousel.tsx`: the `reInit` listener was added and never removed.
- `apps/www/.../hero-demo/hero-prompt.tsx`: the typing debounce could fire after the page was left and start the demo. This timer was not the one the rule flagged; the flagged effect was fine.

Left alone, because they already clean up: `move-files-card`, `imports-page`, `remaining-card`, `run-page`, `palette-host`, `documents-card`, `use-live-globe-data`, `discovery-tracker`, `theme-preview-bridge`, `hero-backdrop`, `tour-stage`, `perfect-match-word`, `use-hero-autoplay`, `floating-format-toolbar-plugin`.

`pay-client.tsx` is unchanged. Line 134 is a listener on the Razorpay object made for one click, not an effect, and the file has no timers. At worst that is one small listener per payment attempt until the page is left, which is not worth touching in a live payment flow.
