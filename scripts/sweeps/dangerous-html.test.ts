/**
 * Sweep: every `dangerouslySetInnerHTML` usage must be on the allow-list below, with a
 * reason. It's a real XSS surface, so each one should be there because the HTML is
 * either fully static/trusted (a `<style>` tag, JSON-LD we built ourselves) or already
 * sanitised upstream (rich text through packages/richtext) — never raw user input.
 *
 * Ratchet: a NEW `dangerouslySetInnerHTML` outside this list fails the sweep.
 */
import { describe, expect, it } from 'vitest'
import { findDangerousHtml, listFiles, loadSourceFile, toRel } from './walk'

type AllowEntry = { file: string; reason: string }

const ALLOWLIST: AllowEntry[] = [
  {
    file: 'packages/blocks/src/components/custom/embed-element.tsx',
    reason:
      'merchant Custom HTML, rendered only after sanitizeEmbedHtml (sanitize-html allow-list: no scripts, handlers, styles or foreign iframes); also sanitised on save',
  },
  {
    file: 'apps/admin/src/components/layout/accent-style.tsx',
    reason: 'injects a <style> tag of computed CSS variables, not user input',
  },
  {
    file: 'apps/admin/src/components/settings/accent-preview.tsx',
    reason: 'injects a <style> tag to preview an accent colour, not user input',
  },
  {
    file: 'apps/admin/src/components/themes/customize/section-live-preview.tsx',
    reason:
      "injects a <style> into the admin's own document (no iframe), every rule scoped under [data-section-live-preview]: themeToCss() of the theme settings being edited",
  },
  {
    file: 'apps/storefront/src/app/-p/[storeId]/layout.tsx',
    reason: 'JSON-LD / theme <style> we build ourselves, not user input',
  },
  {
    file: 'apps/storefront/src/app/-s/[storeId]/blogs/[blog]/[article]/page.tsx',
    reason: 'JSON-LD article structured data via jsonLd(), which escapes `<`',
  },
  {
    file: 'apps/storefront/src/app/-s/[storeId]/blogs/[blog]/page.tsx',
    reason: 'JSON-LD blog structured data via jsonLd(), which escapes `<`',
  },
  {
    file: 'apps/storefront/src/app/-s/[storeId]/layout.tsx',
    reason: 'JSON-LD / theme <style> we build ourselves, not user input',
  },
  {
    file: 'apps/storefront/src/app/-s/[storeId]/page.tsx',
    reason: 'JSON-LD structured data we build ourselves',
  },
  {
    file: 'apps/storefront/src/app/-s/[storeId]/products/[handle]/page.tsx',
    reason: 'JSON-LD product structured data we build ourselves',
  },
  {
    file: 'apps/storefront/src/components/collections/main-collection.tsx',
    reason: 'JSON-LD collection structured data via jsonLd(), which escapes `<`',
  },
  {
    file: 'apps/storefront/src/components/search/main-search.tsx',
    reason:
      'JSON-LD search results structured data, JSON.stringify with every `<` replaced by \\u003c',
  },
  {
    file: 'packages/blocks/src/components/icon.tsx',
    reason: 'renders a fixed, bundled SVG icon set, not user input',
  },
  {
    file: 'packages/ui/src/components/shadcn/chart.tsx',
    reason: 'vendored shadcn chart component, injects computed CSS variables',
  },
]

function isAllowlisted(file: string): boolean {
  return ALLOWLIST.some((e) => e.file === file)
}

async function findViolations(): Promise<string[]> {
  const files = await listFiles(['apps', 'packages'], { includeTests: false })
  const out: string[] = []
  for (const f of files) {
    const rel = toRel(f)
    if (!rel.endsWith('.tsx')) continue
    const sf = loadSourceFile(f)
    if (findDangerousHtml(sf).length > 0) out.push(rel)
  }
  return out
}

describe('sweep: dangerous-html', () => {
  it('every dangerouslySetInnerHTML usage is allow-listed with a reason', async () => {
    const violations = await findViolations()
    const unlisted = violations.filter((v) => !isAllowlisted(v))
    expect(unlisted, `new dangerouslySetInnerHTML usage:\n${unlisted.join('\n')}`).toEqual([])
  })

  it('the allow-list has no stale entries', async () => {
    const violations = await findViolations()
    const stale = ALLOWLIST.filter((e) => !violations.includes(e.file))
    expect(stale).toEqual([])
  })
})
