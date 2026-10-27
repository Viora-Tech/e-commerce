/**
 * Sweep: hex colour literals (`#fff`, `#a1b2c3`) in `.tsx` UI files, outside the places
 * that legitimately define colour tokens (theme presets/schema, email themes, invoice
 * PDF templates, vendored shadcn) or read them back out of CSS variables. Per
 * docs/conventions.md, UI code should use CSS variables from `globals.css`, never
 * hardcode colours like `gray-300` (or a raw hex).
 *
 * Scope is deliberately narrow — `.tsx` files under the app/component/block/editor UI
 * roots, minus the vendored shadcn directory — so this doesn't flag legitimate palette
 * *definitions* (e.g. `packages/core/src/theme/presets.ts`), only UI code that should be
 * reading a token instead.
 *
 * Ratchet: a NEW hex colour in scope outside the allow-list fails the sweep.
 *
 * Second check, same scope: Tailwind palette classes (`bg-red-500`, `text-neutral-700`,
 * `ring-gray-200/50`) are raw colours too, they just look like utilities. Use the theme
 * tokens (`bg-primary`, `text-muted-foreground`, `border-border`, `text-destructive`) instead.
 * Same ratchet, own allow-list (`PALETTE_ALLOWLIST`).
 */
import { describe, expect, it } from 'vitest'
import { findPaletteClasses } from './consistency'
import { findHexColours, listFiles, loadSourceFile, toRel } from './walk'

const SCOPE_ROOTS = [
  'apps/admin/src/components',
  'apps/admin/src/app',
  'apps/storefront/src/components',
  'apps/storefront/src/app',
  'packages/blocks/src',
  'packages/ui/src',
  'packages/editor/src',
]

type AllowEntry = { file: string; reason: string }

const ALLOWLIST: AllowEntry[] = [
  {
    file: 'apps/storefront/src/components/checkout/payment-methods.tsx',
    reason:
      "payment gateway name chips (Razorpay, Cashfree, PhonePe…) in each gateway's own brand colour, which the merchant's checkout branding should not restyle",
  },
  {
    file: 'apps/storefront/src/components/checkout/payment-mark.tsx',
    reason:
      "UPI app and card network marks (Google Pay, PhonePe, Paytm, UPI, VISA, RuPay) on the checkout's Express buttons and payment cards, in each brand's own colours so shoppers recognise them; the merchant's checkout branding must not restyle them",
  },
  {
    file: 'apps/admin/src/components/mcp/mcp-client-logo.tsx',
    reason:
      "third-party brand marks (Claude, VS Code) drawn in each vendor's own brand colour, which no theme token should restyle",
  },
  {
    file: 'apps/admin/src/components/settings/accent-wheel.tsx',
    reason:
      'the accent colour wheel paints the full hue spectrum with a white centre; it shows raw colours the merchant picks from, not themed UI',
  },
  {
    file: 'apps/admin/src/components/analytics/live-globe/globe-settings-panel.tsx',
    reason:
      'Live view globe colour presets (Night, Ocean blue, Mono) and colour-picker fallbacks: they are uploaded to the WebGL shader as RGB uniforms, which cannot read CSS custom properties; the default "Store accent" preset still comes from theme tokens',
  },
  {
    file: 'apps/admin/src/components/apps/gst-invoices/look-group.tsx',
    reason:
      'accent-colour presets are stored as invoice.accentColor and passed straight into the react-pdf templates (packages/invoices/src/templates), which render outside the DOM and cannot resolve CSS custom properties — swapping these for var(--chart-N) would store an unusable value and break the PDF',
  },
  {
    file: 'apps/admin/src/components/themes/customize/background-field.tsx',
    reason:
      'the white swatch is a stored section-background value: the setting holds a raw hex string and `<input type="color">` needs a hex start value, neither is app UI colour',
  },
  {
    file: 'apps/admin/src/components/metaobjects/colour-input.tsx',
    reason:
      'the Colour field of Content types: a swatch picker for a merchant-chosen raw colour; `<input type="color">` needs a hex start value and the box shows a hex example, neither is app UI colour',
  },
  {
    file: 'apps/admin/src/components/growth/campaigns/email-preview.tsx',
    reason: 'previews an email whose colours are author-chosen inline styles, not app UI',
  },
  {
    file: 'apps/admin/src/components/products/product-categories-card.tsx',
    reason:
      'approximate swatches for arbitrary merchant-typed colour option values (e.g. "Red", "Charcoal") — a lookup of real-world colour names, not the app theme palette, so the existing accent/chart tokens are not a semantic match; kept as a swatch picker per the sweep exception',
  },
  {
    file: 'apps/admin/src/components/themes/theme-swatch.tsx',
    reason: 'renders a merchant-picked theme colour swatch, inherently a raw colour value',
  },
]

const PALETTE_ALLOWLIST: AllowEntry[] = [
  {
    file: 'apps/admin/src/components/apps/app-logo.tsx',
    reason:
      'one brand gradient per built-in app tile (amber Reviews, blue GST, etc.): each app has its own identity colour that is not a theme role, so no semantic token fits; the glyph on top stays white in both themes',
  },
  {
    file: 'apps/admin/src/components/orders/packing-slip.tsx',
    reason:
      'printed packing slip: fixed neutral ink on paper, deliberately not the screen theme (dark mode must not print grey on white)',
  },
]

function isAllowlisted(file: string): boolean {
  return ALLOWLIST.some((e) => e.file === file)
}

async function findViolations(
  find: (sf: ReturnType<typeof loadSourceFile>) => number[] = findHexColours,
): Promise<string[]> {
  const files = await listFiles(SCOPE_ROOTS, { includeTests: false })
  const out: string[] = []
  for (const f of files) {
    const rel = toRel(f)
    if (!rel.endsWith('.tsx')) continue
    if (rel.startsWith('packages/ui/src/components/shadcn/')) continue
    const sf = loadSourceFile(f)
    if (find(sf).length > 0) out.push(rel)
  }
  return out
}

describe('sweep: hardcoded-colours', () => {
  it('every hex colour in scope is allow-listed with a reason', async () => {
    const violations = await findViolations()
    const unlisted = violations.filter((v) => !isAllowlisted(v))
    expect(unlisted, `new hardcoded colour:\n${unlisted.join('\n')}`).toEqual([])
  })

  it('the allow-list has no stale entries', async () => {
    const violations = await findViolations()
    const stale = ALLOWLIST.filter((e) => !violations.includes(e.file))
    expect(stale).toEqual([])
  })

  it('every Tailwind palette class in scope is allow-listed with a reason', async () => {
    const violations = await findViolations(findPaletteClasses)
    const unlisted = violations.filter((v) => !PALETTE_ALLOWLIST.some((e) => e.file === v))
    expect(unlisted, `use a theme token, not a palette class:\n${unlisted.join('\n')}`).toEqual([])
  })

  it('the palette allow-list has no stale entries', async () => {
    const violations = await findViolations(findPaletteClasses)
    expect(PALETTE_ALLOWLIST.filter((e) => !violations.includes(e.file))).toEqual([])
  })
})
