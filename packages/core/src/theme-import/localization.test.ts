/** SOURCE OF TRUTH: imported theme localization tests — the country selector lists every market's countries, `routes` and `request.locale` follow the market's prefix and language, and a store in its own market renders as before markets */
import { describe, expect, it } from 'vitest'
import { fakeDataSource, fixtureThemeZip } from '../../test/theme-import-fixture'
import { readThemeArchive } from './archive'
import { buildThemeBundle } from './bundle'
import { LIQUID_ROUTES } from './drops'
import { DEFAULT_LIQUID_MARKET, type LiquidMarket, liquidLocalization } from './localization'
import { createPageContext } from './page-context'
import { renderLiquidSection } from './render'

const GULF: LiquidMarket = {
  id: 'gulf',
  handle: 'gulf',
  locale: 'ar',
  languages: [
    { code: 'en', rootUrl: '/ae' },
    { code: 'ar', rootUrl: '/ar-ae' },
  ],
  country: 'OM',
  countries: ['IN', 'AE', 'OM'],
  prefix: '/ar-ae',
}

/** Dawn's selector, cut down: the current choice, every country, every language, two routes. */
const SELECTOR = `<p>{{ localization.country.name }}|{{ localization.country.currency.iso_code }}|{{ localization.language.endonym_name }}|{{ request.locale.iso_code }}|{{ request.locale.root_url }}|{{ routes.root_url }}|{{ routes.cart_url }}|{{ localization.market.handle }}</p>
<ul>{%- for c in localization.available_countries -%}<li>{{ c.iso_code }}:{{ c.name }}</li>{%- endfor -%}</ul>
<ol>{%- for l in localization.available_languages -%}<li>{{ l.iso_code }}{% if l.primary %}*{% endif %}</li>{%- endfor -%}</ol>
{% schema %}{"name":"Selector","settings":[]}{% endschema %}`

async function renderSelector(market: LiquidMarket | undefined) {
  const archive = readThemeArchive(
    fixtureThemeZip({ extra: { 'sections/selector.liquid': SELECTOR } }),
  )
  const textFiles = new Map<string, string>()
  for (const f of archive.files.values())
    if (f.text) textFiles.set(f.path, new TextDecoder().decode(f.bytes))
  const bundle = buildThemeBundle({
    themeId: 'theme-1',
    version: 'v1',
    textFiles,
    assetChecksums: new Map(),
    settings: {},
  })
  const ctx = await createPageContext({
    bundle,
    data: fakeDataSource(),
    request: {
      template: 'index',
      path: '/',
      host: 'shop.example',
      origin: 'https://shop.example',
      designMode: false,
      postedForm: null,
      nonce: 'n0nce',
      market,
    },
    assetBase: '/theme-assets/theme-1',
    shopifyHost: null,
    moneyFormat: null,
    paymentTypes: [],
  })
  return renderLiquidSection(ctx, {
    id: 'selector',
    type: 'selector',
    settings: {},
    blocks: [],
    location: 'template',
    index: 0,
  })
}

describe('localization in an imported theme', () => {
  it('renders India in English with no market, as before markets', async () => {
    const html = await renderSelector(undefined)
    expect(html).toContain('<p>India|INR|English|en|/|/|/cart|india</p>')
    expect(html).toContain('<ul><li>IN:India</li></ul>')
    expect(html).toContain('<ol><li>en*</li></ol>')
    expect(liquidLocalization(DEFAULT_LIQUID_MARKET, 'INR').routes).toBe(LIQUID_ROUTES)
  })

  it("lists every market's countries and follows the market's prefix and language", async () => {
    const html = await renderSelector(GULF)
    expect(html).toContain('<p>Oman|INR|العربية|ar|/ar-ae|/ar-ae|/ar-ae/cart|gulf</p>')
    expect(html).toContain(
      '<ul><li>IN:India</li><li>OM:Oman</li><li>AE:United Arab Emirates</li></ul>',
    )
    expect(html).toContain('<ol><li>en*</li><li>ar</li></ol>')
  })

  it('gives each language its own root', () => {
    const { localization } = liquidLocalization(GULF, 'INR')
    expect(localization.available_languages.map((l) => [l.iso_code, l.root_url])).toEqual([
      ['en', '/ae'],
      ['ar', '/ar-ae'],
    ])
    expect(localization.country?.currency).toEqual({
      iso_code: 'INR',
      symbol: '₹',
      name: 'Indian Rupee',
    })
  })

  it('gives dirhams their own symbol, never the code twice (#86)', () => {
    const { localization } = liquidLocalization(GULF, 'AED')
    expect(localization.country?.currency.symbol).toBe('د.إ')
  })
})
