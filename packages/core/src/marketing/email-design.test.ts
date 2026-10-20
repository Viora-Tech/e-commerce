import { describe, expect, it } from 'vitest'
import { campaignProblems } from './campaign-input'
import {
  decodeEntities,
  discountMjml,
  type EmailBrand,
  EmailDesignSchema,
  footerMjml,
  hasUnsubscribeTag,
  htmlToPlainText,
  logoMjml,
  productGridMjml,
  renderDesignedEmail,
  sanitizeEmailHtml,
  socialMjml,
  starterMjml,
} from './email-design'
import { compileEmailDesign } from './email-design-compile'

const brand: EmailBrand = {
  storeName: 'Waimers & Co',
  logoUrl: 'https://cdn.test/logo.png',
  logoWidth: 140,
  colours: {
    background: '#ffffff',
    text: '#1F1F21',
    muted: '#6B6B6E',
    button: '#6C3BAA',
    buttonText: '#FFFFFF',
  },
  social: [
    { platform: 'instagram', url: 'https://instagram.com/waimers' },
    { platform: 'whatsapp', url: 'https://wa.me/919999999999' },
  ],
}

const ctx = {
  storeName: 'Waimers',
  storeAddress: 'Sonipat, Haryana',
  shopUrl: 'https://shop.test',
  merge: { first_name: 'Asha <3' },
}

const design = `<!doctype html><html><head><style>.a{color:red}</style></head><body><p>Hi {first_name}, from {store_name}</p><a href="{shop_url}/products/pad?a=1&amp;b=2">Shop the pad</a><img src="https://cdn.test/x.png" alt="Glasspad"><a href="{unsubscribe_url}">Unsubscribe</a></body></html>`

describe('renderDesignedEmail', () => {
  it('fills merge tags, escaping them in text and keeping links raw', () => {
    const { html } = renderDesignedEmail(design, ctx)
    expect(html).toContain('Hi Asha &lt;3, from Waimers')
    expect(html).toContain('href="https://shop.test/products/pad?a=1&amp;b=2"')
    expect(html).toContain('.a{color:red}')
  })

  it('tracks every http link except the unsubscribe link', () => {
    const { html } = renderDesignedEmail(design, {
      ...ctx,
      unsubscribeUrl: 'https://shop.test/unsubscribe/tok',
      trackLink: (u) => `https://shop.test/c?u=${encodeURIComponent(u)}`,
    })
    expect(html).toContain(
      `href="https://shop.test/c?u=${encodeURIComponent('https://shop.test/products/pad?a=1&b=2')}"`,
    )
    expect(html).toContain('href="https://shop.test/unsubscribe/tok"')
    // The design has its own unsubscribe link, so no second footer is added.
    expect(html.match(/unsubscribe\/tok/g)).toHaveLength(1)
  })

  it('adds the standard footer, preview text and pixel when the design has no unsubscribe link', () => {
    const { html, text } = renderDesignedEmail('<html><body><p>Sale</p></body></html>', {
      ...ctx,
      previewText: 'Hello {first_name}',
      unsubscribeUrl: 'https://shop.test/u/1',
      openPixelUrl: 'https://shop.test/o/1.gif',
    })
    expect(html).toMatch(/<body><div style="display:none[^"]*">Hello Asha &lt;3/)
    expect(html).toContain('href="https://shop.test/u/1"')
    expect(html).toContain('Sonipat, Haryana')
    expect(html.indexOf('o/1.gif')).toBeLessThan(html.indexOf('</body>'))
    expect(text).toContain('Unsubscribe (https://shop.test/u/1)')
    expect(text).not.toContain('Hello Asha')
  })

  it('neutralises unsafe links and scripts', () => {
    const { html } = renderDesignedEmail(
      '<body><a href="javascript:alert(1)" onclick="x()">x</a><script>bad()</script></body>',
      ctx,
    )
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('bad()')
  })

  it('leaves unknown braces alone', () => {
    expect(renderDesignedEmail('<body>{x} {first_name}</body>', ctx).html).toContain(
      '{x} Asha &lt;3',
    )
  })
})

describe('htmlToPlainText', () => {
  it('turns links, images, line breaks and entities into readable text', () => {
    const text = htmlToPlainText(
      '<html><head><title>T</title></head><body><!--[if mso]><table><![endif]--><h1>Big&nbsp;sale</h1><p>Line one<br>Line two</p><a href="https://x.test">https://x.test</a> <a href="https://y.test"><img alt="Banner" src="b.png"></a><ul><li>One</li></ul><p>Tom &amp; Jerry &#8377;99</p></body></html>',
    )
    expect(text).toBe(
      'Big sale\nLine one\nLine two\nhttps://x.test Banner (https://y.test)\n- One\n\nTom & Jerry ₹99',
    )
  })

  it('decodes numeric and named entities', () => {
    expect(decodeEntities('&#x20B9;&#39;&quot;&unknown;')).toBe('₹\'"&unknown;')
  })
})

describe('sanitizeEmailHtml', () => {
  it('drops frames, forms and data: sources', () => {
    const out = sanitizeEmailHtml(
      '<iframe src="https://x"></iframe><form><input></form><img src="data:text/html,x">',
    )
    expect(out).not.toMatch(/iframe|form|data:/)
  })
})

describe('store blocks', () => {
  it('draws a product grid with the store colours and merge-tag links', () => {
    const mjml = productGridMjml(
      [
        {
          title: 'Pad <XL>',
          priceLabel: '₹1,999',
          imageUrl: 'https://cdn.test/p.png',
          handle: 'pad xl',
        },
        { title: 'Mouse', priceLabel: '₹999', handle: 'mouse' },
        { title: 'Skates', priceLabel: '₹299', imageUrl: 'javascript:x', handle: 'skates' },
      ],
      brand,
      { columns: 2, buttonLabel: 'Shop now' },
    )
    expect(mjml.match(/<mj-section/g)).toHaveLength(2)
    expect(mjml.startsWith('<mj-wrapper')).toBe(true)
    expect(mjml).toContain('href="{shop_url}/products/pad%20xl"')
    expect(mjml).toContain('Pad &lt;XL&gt;')
    expect(mjml).toContain('background-color="#6C3BAA"')
    expect(mjml).not.toContain('javascript')
  })

  it('draws a discount, logo, socials and footer', () => {
    expect(
      discountMjml({ code: 'DIWALI10', heading: 'Your code', note: '10% off' }, brand),
    ).toContain('DIWALI10')
    expect(logoMjml(brand)).toContain('src="https://cdn.test/logo.png"')
    expect(logoMjml({ ...brand, logoUrl: null })).toContain('Waimers &amp; Co')
    const social = socialMjml(brand)
    expect(social).toContain('name="instagram-noshare"')
    expect(social).toContain('name="web-noshare"')
    expect(socialMjml({ ...brand, social: [] })).toBe('')
    expect(hasUnsubscribeTag(footerMjml(brand, { reason: 'Why', unsubscribe: 'Leave' }))).toBe(true)
  })

  it('falls back when a colour is not hex', () => {
    const odd = { ...brand, colours: { ...brand.colours, button: 'red;x:"' } }
    expect(discountMjml({ code: 'A', heading: 'B' }, odd)).toContain('border="1px dashed #1a1a1a"')
  })
})

describe('compileEmailDesign', () => {
  it('compiles the starter design to responsive HTML that keeps merge tags', async () => {
    const mjml = starterMjml(brand, {
      heading: 'Hi {first_name}',
      body: 'New drops this week.',
      button: 'Shop now',
      reason: 'You subscribed.',
      unsubscribe: 'Unsubscribe',
    })
    const { html, errors } = await compileEmailDesign(mjml)
    expect(errors).toEqual([])
    expect(html).toContain('Hi {first_name}')
    expect(html).toContain('href="{shop_url}"')
    expect(html).toContain('href="{unsubscribe_url}"')
    expect(html).toMatch(/@media only screen and \(min-width:480px\)/)
    const sent = renderDesignedEmail(html, { ...ctx, unsubscribeUrl: 'https://shop.test/u/2' })
    expect(sent.html).toContain('href="https://shop.test/u/2"')
    expect(sent.text).toContain('Hi Asha <3')
  })

  it('never reads included files, and handles empty and oversized input', async () => {
    const included = await compileEmailDesign(
      '<mjml><mj-body><mj-include path="/etc/passwd" /></mj-body></mjml>',
    )
    expect(included.html).not.toContain('root:')
    expect((await compileEmailDesign('')).html).toBe('')
    expect((await compileEmailDesign('x'.repeat(400_001))).errors).toEqual(['design is too large'])
  })
})

describe('visual campaigns', () => {
  it('need a design before they can be scheduled', () => {
    const base = { kind: 'email' as const, subject: 'Hi', blocks: [], whatsapp: null }
    expect(campaignProblems({ ...base, editor: 'visual', design: null })).toEqual(['content'])
    expect(
      campaignProblems({ ...base, editor: 'visual', design: { mjml: '<mjml/>', html: '<p>' } }),
    ).toEqual([])
    expect(EmailDesignSchema.parse({ project: { pages: [] }, mjml: '<mjml/>' }).html).toBe('')
  })
})
