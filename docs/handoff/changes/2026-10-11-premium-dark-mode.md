# Premium dark mode (2026-10-11)

The owner said dark mode looked cheap next to light. Dark tokens in `packages/ui/src/styles.css`
were rebuilt as one system (Proofly dark as the reference); light is unchanged (pixel diff of 19
screens at 1440: identical except the product-page Replace button, which now has a card fill so it
reads over the picture).

- Layers: shell `#0b0c0e` < panel `#101114` < card `#16171b` < raised `#1c1d22`, cool tint, small
  steps. Inputs `#121316`. Text `#e6e7ea` / titles `#f5f6f8` / muted `#9aa0ab` / soft `#858b95`
  (all AA on panel, card, popover).
- Lines: one white-alpha scale (rows 5%, hairline 6%, card edge 7%, border 9%, input 10%,
  strong 15%). Card elevation is hairline + 4% top highlight + 1px contact shadow.
- Key button: deep accent well with pale ink instead of saturated fill + white text + glow.
  `darkKey()` in `@commerce/core/admin-accent` derives it for any accent; `designVars` dark now
  uses it, soft fills are the lifted accent at 12% alpha, the derived dark tint matches the
  default's depth, and `--glass-active` follows the accent. Tests pin the stylesheet values.
- Status tones lifted for dark on 10-12% fills; solid fills get dark ink (`--*-foreground`).
- New tokens: `--media` / `--media-tile` (light ground behind product pictures; white in light),
  `--avatar` / `--avatar-foreground` (initials discs: ink in light, accent tint in dark),
  `--scrollbar-thumb` (admin `globals.css` hex replaced), `--key-neutral-hover` (dark hover was
  darkening the key-neutral button). Dark `::selection` follows the accent.
- Docs: developer docs "Admin design system" (dark sections rewritten), `admin-frames.md` stale
  iOS-dark line superseded.

Not touched: layouts, light values, the storefront. Seen while testing, not fixed here: the
keyboard-shortcuts dialog has a duplicate React key ("Open search"); `no-orphans` sweep fails on
`S3_COMPAT_OP_TIMEOUT_MS` (already on dev).
