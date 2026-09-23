import { describe, expect, it } from 'vitest'
import { campaignProblems } from './campaign-input'
import {
  applyMergeTags,
  EMAIL_BLOCK_TYPES,
  type EmailBlock,
  newEmailBlock,
  parseEmailBlocks,
  renderMarketingEmail,
} from './email'
import { previewWhatsappBody } from './whatsapp'

const ctx = {
  storeName: 'Waimers',
  storeAddress: 'Sonipat, Haryana',
  shopUrl: 'https://shop.test',
  merge: { first_name: 'Asha', store_name: 'Waimers' },
}

describe('merge tags', () => {
  it('fills known tags and leaves other braces alone', () => {
    expect(applyMergeTags('Hi {first_name} from {store_name} {unknown}', ctx.merge)).toBe(
      'Hi Asha from Waimers {unknown}',
    )
    expect(applyMergeTags('{discount_code}', {})).toBe('')
  })
})

describe('renderMarketingEmail', () => {
  const blocks: EmailBlock[] = [
    { id: '1', type: 'header' },
    {
      id: '2',
      type: 'text',
      heading: 'Hi {first_name}',
      text: 'Line <b>one</b>\n\nTwo',
      align: 'left',
    },
    { id: '3', type: 'button', label: 'Shop', url: 'javascript:alert(1)' },
    { id: '4', type: 'button', label: 'Shop now', url: '{shop_url}/collections/all' },
    { id: '5', type: 'discount', code: 'DIWALI20', heading: '', note: 'Ends Sunday' },
    {
      id: '6',
      type: 'products',
      heading: 'Picks',
      items: [
        { id: 'p', title: 'Glasspad', priceLabel: '₹3,999', imageUrl: null, handle: 'glasspad' },
      ],
    },
    { id: '7', type: 'image', url: 'data:image/png;base64,xx', alt: 'x' },
    { id: '8', type: 'cart' },
    { id: '9', type: 'divider' },
  ]

  it('escapes text, drops unsafe links and renders every block', () => {
    const { html, text } = renderMarketingEmail(blocks, {
      ...ctx,
      previewText: 'New pads for {first_name}',
      unsubscribeUrl: 'https://shop.test/unsubscribe/t',
      openPixelUrl: 'https://shop.test/api/m/open/t',
      trackLink: (u) => `https://shop.test/api/m/click/t?u=${encodeURIComponent(u)}`,
    })
    expect(html).toContain('Hi Asha')
    expect(html).toContain('Line &lt;b&gt;one&lt;/b&gt;')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('data:image')
    expect(html).toContain(
      'https://shop.test/api/m/click/t?u=https%3A%2F%2Fshop.test%2Fcollections%2Fall',
    )
    expect(html).toContain('DIWALI20')
    expect(html).toContain('Glasspad')
    expect(html).toContain('New pads for Asha')
    expect(html).toContain('https://shop.test/unsubscribe/t')
    expect(html).toContain('https://shop.test/api/m/open/t')
    expect(html).toContain('Sonipat, Haryana')
    expect(text).toContain('Unsubscribe: https://shop.test/unsubscribe/t')
    expect(text).toContain('Your code: DIWALI20')
  })

  it('renders the basket only when there is one', () => {
    const withCart = renderMarketingEmail([{ id: 'c', type: 'cart' }], {
      ...ctx,
      cart: {
        lines: [{ title: 'Glasspad', quantity: 2, priceLabel: '₹7,998' }],
        totalLabel: '₹7,998',
      },
    })
    expect(withCart.html).toContain('Qty 2')
    expect(withCart.text).toContain('2 x Glasspad')
  })
})

describe('blocks', () => {
  it('creates every block type and drops invalid stored ones', () => {
    const made = EMAIL_BLOCK_TYPES.map((t, i) => newEmailBlock(t, String(i)))
    expect(parseEmailBlocks([...made, { type: 'nope' }, null])).toHaveLength(made.length)
    expect(parseEmailBlocks('x')).toEqual([])
  })
})

describe('campaign readiness', () => {
  it('needs a subject and content for email, a template and every variable for WhatsApp', () => {
    expect(campaignProblems({ kind: 'email', subject: '', blocks: [], whatsapp: null })).toEqual([
      'subject',
      'content',
    ])
    expect(campaignProblems({ kind: 'whatsapp', subject: '', blocks: [], whatsapp: null })).toEqual(
      ['template'],
    )
    expect(
      campaignProblems({
        kind: 'whatsapp',
        subject: '',
        blocks: [],
        whatsapp: { name: 't', language: 'en', variables: ['a'] },
        variableCount: 2,
      }),
    ).toEqual(['variables'])
  })

  it('previews a WhatsApp body with its variables', () => {
    expect(previewWhatsappBody('Hi {{1}}, {{2}} off', ['Asha', ''])).toBe('Hi Asha, {{2}} off')
  })
})
