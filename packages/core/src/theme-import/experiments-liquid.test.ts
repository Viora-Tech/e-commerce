/** SOURCE OF TRUTH: `request.experiments` tests — imported themes branch on the shopper's A/B test variation (the GrowthBook app), rendered through the real engine on fake data. No database */
import { describe, expect, it } from 'vitest'
import { fakeDataSource } from '../../test/theme-import-fixture'
import { buildThemeBundle } from './bundle'
import { createPageContext } from './page-context'
import { renderLiquidSection } from './render'

let themes = 0

async function render(source: string, experiments?: Record<string, number>) {
  const bundle = buildThemeBundle({
    themeId: `experiments-${themes++}`,
    version: 'v1',
    textFiles: new Map([['sections/probe.liquid', source]]),
    assetChecksums: new Map(),
    settings: {},
  })
  const ctx = await createPageContext({
    bundle,
    data: fakeDataSource({}),
    request: {
      template: 'index',
      path: '/',
      host: 'shop.example',
      origin: 'https://shop.example',
      designMode: false,
      postedForm: null,
      nonce: '',
      experiments,
    },
    assetBase: '/theme-assets/x',
    shopifyHost: null,
    moneyFormat: null,
    paymentTypes: [],
  })
  const html = await renderLiquidSection(
    ctx,
    { id: 'probe', type: 'probe', settings: {}, blocks: [], location: 'template', index: 0 },
    (err) => {
      throw err
    },
  )
  return html.trim()
}

const BRANCH = "{%- if request.experiments['hero-test'] == 1 -%}big{%- else -%}control{%- endif -%}"

describe('request.experiments', () => {
  it('draws the variant the shopper is in', async () => {
    const big = await render(BRANCH, { 'hero-test': 1 })
    expect(big).toContain('big')
    expect(big).not.toContain('control')
    expect(await render(BRANCH, { 'hero-test': 0 })).toContain('control')
  })

  it('draws the control for a shopper outside the experiment, or without any', async () => {
    expect(await render(BRANCH, { other: 1 })).toContain('control')
    expect(await render(BRANCH)).toContain('control')
  })
})
