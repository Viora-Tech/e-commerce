/** SOURCE OF TRUTH: imported theme footer policy tests — `shop.policies` and `shop.privacy_policy` etc. from the store's published policies, `powered_by_link` never crediting Shopify, and `link_to` named attributes */
import { describe, expect, it } from 'vitest'
import { fakeDataSource, fixtureThemeZip } from '../../test/theme-import-fixture'
import { readThemeArchive } from './archive'
import { buildThemeBundle } from './bundle'
import type { LiquidPolicyData } from './drops'
import { createPageContext } from './page-context'
import { renderLiquidSection } from './render'

/** The policy row of a Shopify theme's footer, as Waimers' theme writes it. */
const FOOTER = `<ul class="footer__policies">{%- for policy in shop.policies -%}{%- if policy != blank -%}<li><a href="{{ policy.url }}" class="footer__policy-link">{{ policy.title | escape }}</a></li>{%- endif -%}{%- endfor -%}</ul>
<p class="single">{%- if shop.privacy_policy -%}<a href="{{ shop.privacy_policy.url }}">{{ shop.privacy_policy.title }}</a>{%- endif -%}|{%- if shop.shipping_policy -%}SHIP{%- endif -%}</p>
<p class="copyright">&copy; 2026 {{ shop.name | link_to: routes.root_url, class: 'footer__copyright-link' }}. {{ powered_by_link }}</p>
{% schema %}{"name":"Footer","settings":[]}{% endschema %}`

const POLICIES: LiquidPolicyData[] = [
  { type: 'refund-policy', title: 'Refund policy', url: '/policies/refund-policy' },
  { type: 'privacy-policy', title: 'Privacy policy', url: '/policies/privacy-policy' },
  { type: 'terms-of-service', title: 'Terms of service', url: '/policies/terms-of-service' },
  {
    type: 'contact-information',
    title: 'Contact information',
    url: '/policies/contact-information',
  },
]

async function renderFooter(policies: LiquidPolicyData[]) {
  const archive = readThemeArchive(
    fixtureThemeZip({ extra: { 'sections/policies.liquid': FOOTER } }),
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
  const data = fakeDataSource()
  data.shop = { ...data.shop, policies }
  const ctx = await createPageContext({
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
    assetBase: '/theme-assets/theme-1',
    shopifyHost: null,
    moneyFormat: null,
    paymentTypes: [],
  })
  return renderLiquidSection(ctx, {
    id: 'footer',
    type: 'policies',
    settings: {},
    blocks: [],
    location: 'footer-group',
    index: 0,
  })
}

describe('shop policies in an imported theme', () => {
  it('lists the published policies, linked to our policy pages, in footer order', async () => {
    const html = await renderFooter(POLICIES)
    expect(html).toContain(
      '<ul class="footer__policies"><li><a href="/policies/refund-policy" class="footer__policy-link">Refund policy</a></li><li><a href="/policies/privacy-policy" class="footer__policy-link">Privacy policy</a></li><li><a href="/policies/terms-of-service" class="footer__policy-link">Terms of service</a></li><li><a href="/policies/contact-information" class="footer__policy-link">Contact information</a></li></ul>',
    )
  })

  it('gives each named policy, and nil for one that is not published', async () => {
    const html = await renderFooter(POLICIES)
    expect(html).toContain(
      '<p class="single"><a href="/policies/privacy-policy">Privacy policy</a>|</p>',
    )
  })

  it('shows no policy row items when none are published', async () => {
    const html = await renderFooter([])
    expect(html).toContain('<ul class="footer__policies"></ul>')
    expect(html).toContain('<p class="single">|</p>')
  })

  it('prints the copyright link with its class and no Shopify credit', async () => {
    const html = await renderFooter(POLICIES)
    expect(html).toContain(
      '&copy; 2026 <a class="footer__copyright-link" href="/">Waimers</a>. </p>',
    )
    expect(html.toLowerCase()).not.toContain('shopify.com')
    expect(html).not.toContain('Powered by')
  })
})
