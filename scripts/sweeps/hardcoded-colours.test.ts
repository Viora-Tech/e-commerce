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
 */
import { describe, expect, it } from 'vitest'
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

function isAllowlisted(file: string): boolean {
  return ALLOWLIST.some((e) => e.file === file)
}

async function findViolations(): Promise<string[]> {
  const files = await listFiles(SCOPE_ROOTS, { includeTests: false })
  const out: string[] = []
  for (const f of files) {
    const rel = toRel(f)
    if (!rel.endsWith('.tsx')) continue
    if (rel.startsWith('packages/ui/src/components/shadcn/')) continue
    const sf = loadSourceFile(f)
    if (findHexColours(sf).length > 0) out.push(rel)
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
})
