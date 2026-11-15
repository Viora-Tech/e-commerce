import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import SystemPanel, { SYSTEM_PAGE, SYSTEM_PANEL } from './system-panel'

/** A margin utility without `!`: zeroed by an unlayered `* { margin: 0 }` (an imported theme's). */
const MARGIN = /(?:^|\s)(?:[\w-]+:)*-?m[xytblrse]?-[^\s!]+(?=\s|$)/

/** The system pages that draw their card with SystemPanel, relative to `app/-s/[storeId]`. */
const PAGES = [
  'unsubscribe/[token]/page.tsx',
  'newsletter/confirm/[token]/page.tsx',
  'reviews/unsubscribe/page.tsx',
  'cod/[token]/page.tsx',
]

const pageSource = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../app/-s/[storeId]/${rel}`, import.meta.url)), 'utf8')

describe('SystemPanel', () => {
  it('centres the card inside the theme page width by flex and padding, never margins', () => {
    expect(SYSTEM_PAGE.split(' ')).toEqual(
      expect.arrayContaining(['page-width', 'flex', 'justify-center', 'py-16', 'md:py-24']),
    )
    expect(SYSTEM_PAGE).not.toMatch(MARGIN)
    expect(SYSTEM_PANEL).not.toMatch(MARGIN)
    expect(SYSTEM_PANEL).toContain('bg-surface')
  })

  it('renders the wrapper and the card around its children', () => {
    const html = renderToStaticMarkup(
      createElement(
        SystemPanel,
        null,
        createElement('h1', { className: 'h3' }, 'Email preferences'),
      ),
    )
    expect(html).toBe(
      `<div class="${SYSTEM_PAGE}"><section class="${SYSTEM_PANEL}"><h1 class="h3">Email preferences</h1></section></div>`,
    )
  })

  it.each(PAGES)('%s draws its card with SystemPanel and no margin utilities', (rel) => {
    const source = pageSource(rel)
    expect(source).toContain("import SystemPanel from '@/components/system/system-panel'")
    for (const [, cls] of source.matchAll(/className="([^"]*)"/g)) expect(cls).not.toMatch(MARGIN)
  })
})
