/**
 * Sweep: keep what the admin design audit removed from coming back (audit 6.2 step 17, 14 Nov
 * 2026). Over `apps/admin/src` (tests skipped):
 *
 * 1. No arbitrary type sizes (`text-[0.8125rem]`, `text-[11px]` …): the named scale in
 *    `packages/ui/src/styles.css` (`text-body`, `text-caption`, `text-micro`, `text-period`,
 *    `text-card-title`, `text-section-title`, `text-stat` …) covers them.
 * 2. No raw `text-xs` / `text-sm` / `text-base`: `text-period` and `text-body` are the same sizes
 *    and line heights under a name, and 1rem text is `text-card-title` (or a deliberate exception).
 * 3. No imports of retired `components/kit/` parts (kit-button, kit-icon-button, kit-field,
 *    kit-search, kit-table…): use Button, Field, SearchField and SimpleTable. Only the kit files
 *    still in use may exist.
 * 4. No `rounded-2xl` / `rounded-3xl`: cards are `rounded-lg` (DataCard, ui Card).
 * 5. No `Badge` from `@commerce/ui/shadcn/badge`: states and tags are StatusChip, counts CountBadge.
 *
 * Raw DialogContent is the popup-shell sweep's job, not this one. Every allow-list entry has a
 * reason; the lists may only shrink (stale entries fail).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { listFiles, ROOT, toRel } from './walk'

const ADMIN = 'apps/admin/src'

/** The theme customizer draws its own compact editor chrome (sidebar, inspector, top bar). */
const CUSTOMIZER = [`${ADMIN}/components/themes/customize/`, `${ADMIN}/lib/customize-`]

const ARBITRARY_SIZE_ALLOW: Record<string, string> = {
  [`${ADMIN}/components/settings/checkout-branding-preview.tsx`]:
    'scaled-down miniature of the storefront checkout; sizes are a fraction of the real page',
  [`${ADMIN}/components/growth/overview/autopilot-illustration.tsx`]: 'SVG illustration text',
  [`${ADMIN}/components/home/live-now.tsx`]: 'Home live-now hero figure (2.5rem), one of a kind',
  [`${ADMIN}/components/layout/score-ring.tsx`]: 'score ring figure (2.25rem) sized to the ring',
  [`${ADMIN}/components/layout/palette-body.tsx`]:
    'command palette input (1.0625rem), a search box, not a form field',
  [`${ADMIN}/components/preferences/preferences-previews.tsx`]:
    'text-size preview in Preferences: shows the larger size the shopper picks',
}

const RAW_SIZE_ALLOW: Record<string, string> = {
  [`${ADMIN}/components/assistant/assistant-composer.tsx`]:
    '1rem on phones so iOS does not zoom into the composer (md:text-body above)',
  [`${ADMIN}/components/blog/article-seo-card.tsx`]: 'search-result preview mimics Google sizes',
  [`${ADMIN}/components/products/seo-card.tsx`]: 'search-result preview mimics Google sizes',
  [`${ADMIN}/components/gift-cards/code-reveal-dialog.tsx`]:
    'the gift card code in mono at 1rem, read out to a shopper',
  [`${ADMIN}/components/themes/button-settings.tsx`]: 'preview of the storefront button',
  [`${ADMIN}/components/themes/theme-swatch.tsx`]: 'preview of the storefront heading font',
  [`${ADMIN}/components/orders/customer-card.tsx`]:
    'order page: wave 3 page pass 2 owns the file; swap text-xs for text-period there',
  [`${ADMIN}/components/orders/order-lines-table.tsx`]:
    'order page: wave 3 page pass 2 owns the file; swap text-xs for text-period there',
  [`${ADMIN}/components/orders/payment-card.tsx`]:
    'order page: wave 3 page pass 2 owns the file; swap text-xs for text-period there',
  [`${ADMIN}/components/products/variants-card.tsx`]:
    'product page: wave 3 page pass 3 owns the file; swap text-xs for text-period there',
}

/** Kit parts still in use; everything else in `components/kit/` was retired by the audit. */
const LIVE_KIT = new Set(['kit-list-row', 'kit-progress', 'kit-thumb'])

const ROUNDED_ALLOW: Record<string, string> = {
  [`${ADMIN}/components/apps/app-logo.tsx`]: 'app logo tile (4.5rem), an icon shape, not a card',
  [`${ADMIN}/components/themes/import-theme-screen.tsx`]: 'icon tile, not a card',
  [`${ADMIN}/components/assistant/assistant-turn.tsx`]: 'chat bubble',
  [`${ADMIN}/components/inbox/conversations/suggested-replies.tsx`]: 'reply suggestion pills',
  [`${ADMIN}/components/layout/command-palette.tsx`]: 'command palette glass panel (audit G14)',
  [`${ADMIN}/components/analytics/live-globe/live-globe-hero.tsx`]:
    'floating glass label over the live globe',
  [`${ADMIN}/components/apps/setup-checklist.tsx`]:
    'setup checklist banner; banners are not cards (audit step 5 left them)',
  [`${ADMIN}/components/apps/shopify-import/run-issues-card.tsx`]:
    'import issues warning banner; banners are not cards (audit step 5 left them)',
}

const ARBITRARY_SIZE = /(?<![-\w])text-\[\d*\.?\d+(?:rem|px|em)\]/g
const RAW_SIZE = /(?<![-\w])text-(?:xs|sm|base)(?![-\w])/g
const KIT_IMPORT = /['"](?:@\/|\.{1,2}\/(?:\.\.\/)*)(?:components\/)?kit\/([\w-]+)['"]/g
const ROUNDED = /(?<![-\w])rounded-(?:2xl|3xl)(?![-\w])/g
const BADGE_IMPORT = /from\s+['"]@commerce\/ui\/shadcn\/badge['"]/

type Check = { label: string; offenders: string[]; stale: string[] }

function ratchet(
  label: string,
  files: { rel: string; text: string }[],
  find: (text: string) => string[],
  allow: Record<string, string>,
  skip: (rel: string) => boolean = () => false,
): Check {
  const offenders: string[] = []
  const used = new Set<string>()
  for (const { rel, text } of files) {
    if (skip(rel)) continue
    const hits = find(text)
    if (hits.length === 0) continue
    if (allow[rel]) used.add(rel)
    else offenders.push(`${rel}: ${[...new Set(hits)].join(', ')}`)
  }
  const stale = Object.keys(allow).filter((f) => !used.has(f))
  return { label, offenders, stale }
}

const all = (re: RegExp) => (text: string) => [...text.matchAll(re)].map((m) => m[0])

async function adminFiles() {
  const files = await listFiles([ADMIN])
  return files.map((f) => ({ rel: toRel(f), text: readFileSync(f, 'utf8') }))
}

function assert(check: Check, fix: string) {
  expect(check.offenders, `${check.label}: ${fix}\n${check.offenders.join('\n')}`).toEqual([])
  expect(check.stale, `${check.label}: allow-listed file is clean now, remove it`).toEqual([])
}

describe('sweep: design-guard', () => {
  it('no arbitrary type sizes', async () => {
    const check = ratchet(
      'arbitrary text size',
      await adminFiles(),
      all(ARBITRARY_SIZE),
      ARBITRARY_SIZE_ALLOW,
    )
    assert(check, 'use the named scale (text-body, text-caption, text-micro, text-card-title …)')
  })

  it('no raw text-xs / text-sm / text-base', async () => {
    const check = ratchet(
      'raw text size',
      await adminFiles(),
      all(RAW_SIZE),
      RAW_SIZE_ALLOW,
      (rel) => CUSTOMIZER.some((p) => rel.startsWith(p)),
    )
    assert(check, 'text-xs → text-period, text-sm → text-body, text-base → text-card-title')
  })

  it('no retired kit parts', async () => {
    const offenders: string[] = []
    for (const { rel, text } of await adminFiles()) {
      for (const m of text.matchAll(KIT_IMPORT)) {
        if (!LIVE_KIT.has(m[1] ?? '')) offenders.push(`${rel}: kit/${m[1]}`)
      }
    }
    expect(
      offenders,
      `retired kit part: use Button, Field, SearchField or SimpleTable\n${offenders.join('\n')}`,
    ).toEqual([])
    const kitDir = path.join(ROOT, ADMIN, 'components/kit')
    const present = existsSync(kitDir)
      ? readdirSync(kitDir).map((f) => f.replace(/\.tsx?$/, ''))
      : []
    expect(
      present.filter((f) => !LIVE_KIT.has(f)),
      'new file in components/kit: the kit is being retired, build on the shared parts',
    ).toEqual([])
    expect(
      [...LIVE_KIT].filter((f) => !present.includes(f)),
      'kit part deleted: remove it from LIVE_KIT',
    ).toEqual([])
  })

  it('no rounded-2xl / rounded-3xl', async () => {
    const check = ratchet('rounded-2xl', await adminFiles(), all(ROUNDED), ROUNDED_ALLOW)
    assert(check, 'cards are rounded-lg (DataCard, ui Card)')
  })

  it('no shadcn Badge in the admin', async () => {
    const check = ratchet(
      'Badge',
      await adminFiles(),
      (text) => (BADGE_IMPORT.test(text) ? ['@commerce/ui/shadcn/badge'] : []),
      {},
    )
    assert(check, 'use StatusChip for states and tags, CountBadge for counts')
  })
})
