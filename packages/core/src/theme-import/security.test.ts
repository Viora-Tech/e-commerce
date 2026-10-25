/** SOURCE OF TRUTH: security regressions for imported themes (audit 2026-10-06) — zip bombs, render and output budgets, nonces only on the theme's own scripts, linear-time reads of theme and live-page markup, the media download budget. No database. */
import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { FIXTURE_PRODUCT, fakeDataSource } from '../../test/theme-import-fixture'
import { readThemeArchive, ThemeArchiveProblem } from './archive'
import { buildThemeBundle, nonceThemeScripts } from './bundle'
import { LIQUID_LIMITS } from './engine'
import { liveVideosIn, newMediaBudget, THEME_MEDIA_LIMITS, takeMedia } from './import-media'
import { createPageContext } from './page-context'
import { renderLiquidLayout, renderLiquidSection } from './render'

let themes = 0

async function contextFor(files: Record<string, string>, data = fakeDataSource()) {
  themes += 1
  const bundle = buildThemeBundle({
    themeId: `security-${themes}`,
    version: 'v1',
    textFiles: new Map(Object.entries(files)),
    assetChecksums: new Map(),
    settings: {},
  })
  return createPageContext({
    bundle,
    data,
    request: {
      template: 'index',
      path: '/',
      host: 'shop.example',
      origin: 'https://shop.example',
      designMode: false,
      postedForm: null,
      nonce: 'n0nce',
    },
    assetBase: '/theme-assets/t',
    shopifyHost: null,
    moneyFormat: null,
    paymentTypes: [],
  })
}

const placed = (type: string) => ({
  id: type,
  type,
  settings: {},
  blocks: [],
  location: 'template',
  index: 0,
})

const timed = async <T>(fn: () => Promise<T> | T): Promise<{ value: T; ms: number }> => {
  const started = performance.now()
  const value = await fn()
  return { value, ms: performance.now() - started }
}

/** A zip whose one entry inflates to `bytes` zeros, with the directory claiming `claim`. */
function lyingZip(bytes: number, claim: (compressed: number) => number): Uint8Array {
  const zip = zipSync({ 'layout/theme.liquid': [new Uint8Array(bytes), { level: 9 }] })
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  const central = view.getUint32(zip.length - 22 + 16, true)
  const compressed = view.getUint32(central + 20, true)
  view.setUint32(22, claim(compressed), true)
  view.setUint32(central + 24, claim(compressed), true)
  return zip
}

describe('theme zip bombs (A-01)', () => {
  it('refuses an entry that inflates past what it declares, without inflating it all', async () => {
    for (const claim of [() => 1024, (compressed: number) => compressed]) {
      const zip = lyingZip(64 * 1024 * 1024, claim)
      const { ms } = await timed(() =>
        expect(() => readThemeArchive(zip)).toThrow(ThemeArchiveProblem),
      )
      // fflate's unzipSync spent ~1.5 s per 64 MB here, whatever the entry declared.
      expect(ms).toBeLessThan(500)
    }
  })

  it('still reads an honest zip, stored and deflated entries alike', () => {
    const zip = zipSync({
      'layout/theme.liquid': [strToU8('<html></html>'), { level: 0 }],
      'templates/index.json': [strToU8('{"sections":{},"order":[]}'), { level: 9 }],
      'assets/a.css': strToU8('a{}'.repeat(5000)),
    })
    const archive = readThemeArchive(zip)
    expect(new TextDecoder().decode(archive.files.get('assets/a.css')?.bytes)).toBe(
      'a{}'.repeat(5000),
    )
    expect(archive.files.has('layout/theme.liquid')).toBe(true)
  })
})

describe('render budgets (A-03)', () => {
  const RUNAWAY =
    '{% for a in (1..100000) %}{% for b in (1..100000) %}{% endfor %}{% endfor %}<p>done</p>'

  it('stops a runaway loop at the per-render limit', async () => {
    const ctx = await contextFor({ 'sections/loop.liquid': RUNAWAY })
    const { value, ms } = await timed(() => renderLiquidSection(ctx, placed('loop')))
    expect(value).toContain('could not render')
    expect(ms).toBeLessThan(LIQUID_LIMITS.renderMs + 1500)
  })

  it('holds every render of a page to one budget, then renders nothing more', async () => {
    const ctx = await contextFor({
      'sections/loop.liquid': RUNAWAY,
      'sections/fine.liquid': '<p>fine</p>',
    })
    ctx.budget.spentMs = LIQUID_LIMITS.pageMs - 100
    const { value, ms } = await timed(() => renderLiquidSection(ctx, placed('loop')))
    expect(value).toContain('could not render')
    expect(ms).toBeLessThan(1000)
    expect(await renderLiquidSection(ctx, placed('fine'))).toContain('could not render')
  })

  it('stops a render that writes more than the output limit', async () => {
    const ctx = await contextFor({
      'sections/flood.liquid':
        '{% for a in (1..100000) %}{% for b in (1..100000) %}0123456789{% endfor %}{% endfor %}',
    })
    const { value, ms } = await timed(() => renderLiquidSection(ctx, placed('flood')))
    expect(value).toContain('could not render')
    expect(ms).toBeLessThan(LIQUID_LIMITS.renderMs + 1500)
  })
})

describe("nonces only on the theme's own scripts (A-04)", () => {
  it('gives source scripts the nonce and scripts that arrive in data none', async () => {
    const data = fakeDataSource({
      products: [
        { ...FIXTURE_PRODUCT, id: 'evil', handle: 'evil', title: '<script>alert(1)</script>' },
      ],
    })
    const ctx = await contextFor(
      {
        'sections/s.liquid':
          '<script src="/theme.js"></script>{{ all_products["evil"].title }}{% render "snip" %}',
        'snippets/snip.liquid': '<SCRIPT>window.a = 1</SCRIPT>',
      },
      data,
    )
    const html = await renderLiquidSection(ctx, placed('s'))
    expect(html).toContain('<script nonce="n0nce" src="/theme.js">')
    expect(html).toContain('<SCRIPT nonce="n0nce">window.a = 1')
    expect(html).toContain('<script>alert(1)</script>')
    expect(html.match(/nonce=/g)).toHaveLength(2)
  })

  it('leaves Liquid tags, outputs and raw blocks exactly as written', () => {
    const src =
      "{% assign t = '<script>' %}{{ '<script>' }}{% raw %}<script>x</script>{% endraw %}<script>"
    expect(nonceThemeScripts(src)).toBe(
      "{% assign t = '<script>' %}{{ '<script>' }}{% raw %}<script>x</script>{% endraw %}<script{% commerce_script_nonce %}>",
    )
  })
})

describe('linear-time reads of untrusted markup (A-06)', () => {
  it('splits a layout built to make patterns backtrack, quickly', async () => {
    const layout = `<html${'<head<meta'.repeat(60_000)}`
    const ctx = await contextFor({ 'layout/theme.liquid': layout })
    const { value, ms } = await timed(() => renderLiquidLayout(ctx))
    expect(value.head).toBe('')
    expect(ms).toBeLessThan(2000)
  })

  it('still splits a normal layout and drops the head tags the storefront owns', async () => {
    const ctx = await contextFor({
      'layout/theme.liquid':
        '<html lang="en" class="js"><head><title>T</title><meta charset="utf-8"><link rel="canonical" href="/"><link rel="stylesheet" href="/a.css"></head><body class="b"><main id="m">{{ content_for_layout }}</main></body></html>',
    })
    const parts = await renderLiquidLayout(ctx)
    expect(parts.head).toBe('<link rel="stylesheet" href="/a.css">')
    expect(parts.htmlAttrs).toEqual({ lang: 'en', class: 'js' })
    expect(parts.bodyAttrs).toEqual({ class: 'b' })
    expect(parts.mainAttrs).toEqual({ id: 'm' })
  })

  it("reads the live page's videos, and a page built to backtrack, quickly", () => {
    const page =
      '<div id="shopify-section-template--1__hero"><video poster="//cdn.example/p.jpg"><source src="//cdn.example/v.mp4?x=1&amp;y=2" type="video/mp4"></video></div>' +
      '<div id="shopify-section-template--1__other"></div>'
    expect(liveVideosIn(page, 'hero')).toEqual([
      {
        src: 'https://cdn.example/v.mp4?x=1&y=2',
        mobileSrc: null,
        poster: 'https://cdn.example/p.jpg',
      },
    ])
    const hostile = `<div id="shopify-section-x__hero">${'<video<source src="'.repeat(200_000)}`
    const started = performance.now()
    expect(liveVideosIn(hostile, 'hero')).toEqual([])
    expect(performance.now() - started).toBeLessThan(1000)
  })
})

describe('theme import download budget (A-06)', () => {
  it('stops at the count and at the deadline', () => {
    const budget = newMediaBudget(0)
    for (let i = 0; i < THEME_MEDIA_LIMITS.images; i++) {
      expect(takeMedia(budget, 'images', 1)).toBeNull()
    }
    expect(takeMedia(budget, 'images', 1)).toMatch(/at most/)
    expect(takeMedia(budget, 'videos', THEME_MEDIA_LIMITS.totalMs + 1)).toMatch(/out of time/)
  })
})
