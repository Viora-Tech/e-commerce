import { describe, expect, it } from 'vitest'
import {
  checkEmailDesign,
  type DesignBlock,
  defaultEmailDesign,
  type EmailTemplateDesign,
  parseEmailDesign,
  parseRichText,
  richToPlain,
  sanitizeEmailHtml,
} from '../src/design'
import { applyDesignLook } from '../src/design/design-look'
import { sampleEmailBrand, sampleTemplateDataByTemplate } from '../src/samples'
import { renderEmail } from '../src/templates'
import type { TemplateData, TemplateId } from '../src/types'

/** Edit design, version 2: styles, boxes, slot edits and the new blocks (23 Nov 2026). */

const data = (t: TemplateId, extra: Partial<TemplateData> = {}): TemplateData => ({
  ...sampleTemplateDataByTemplate[t],
  brand: { ...sampleEmailBrand, shopUrl: 'https://shop.example' },
  ...extra,
})

const v2 = (
  blocks: DesignBlock[],
  extra: Partial<EmailTemplateDesign> = {},
): EmailTemplateDesign => ({
  version: 2,
  blocks,
  removed: [],
  ...extra,
})

const render = (t: TemplateId, design: unknown, extra: Partial<TemplateData> = {}) =>
  renderEmail(t, data(t, { ...extra, design }))

describe('version 2 schema', () => {
  it('reads a version 1 design as version 2, block for block', () => {
    const old = { ...defaultEmailDesign('order_placed'), version: 1 }
    const parsed = parseEmailDesign(old)
    expect(parsed?.version).toBe(2)
    expect(parsed?.blocks).toEqual(old.blocks)
    expect(parsed?.styles).toBeUndefined()
  })

  it('an old design sends exactly the email it sent before', async () => {
    const d = defaultEmailDesign('order_shipped')
    const asV1 = await render('order_shipped', { ...d, version: 1 })
    const asV2 = await render('order_shipped', d)
    expect(asV2.html).toBe(asV1.html)
  })

  it('keeps known styles and drops the rest', () => {
    const parsed = parseEmailDesign({
      version: 2,
      blocks: [],
      removed: [],
      styles: { font: 'arial', size: 40, text: '#123456', link: 'red', width: 10, bogus: 1 },
    })
    expect(parsed?.styles).toEqual({ font: 'arial', size: 18, text: '#123456', width: 480 })
  })

  it('keeps only the slot edits its kind allows', () => {
    const parsed = parseEmailDesign(
      v2([
        {
          id: 'items#0',
          type: 'slot',
          slot: 'items#0',
          edit: {
            texts: { title: 'Your bag', nope: 'x' },
            hide: ['image', 'everything'],
            colours: { ink: '#112233', bg: '#ffffff' },
            button: { shape: 'pill' },
          },
        },
      ]),
    )
    expect(parsed?.blocks[0]).toEqual({
      id: 'items#0',
      type: 'slot',
      slot: 'items#0',
      edit: { texts: { title: 'Your bag' }, hide: ['image'], colours: { ink: '#112233' } },
    })
  })

  it('check refuses what a send would drop: bad links, unknown blocks, bad cells, locked removals', () => {
    const issues = (d: unknown) => {
      const r = checkEmailDesign(d)
      return r.ok ? [] : r.issues
    }
    expect(
      issues(
        v2([
          {
            id: 'h',
            type: 'hero',
            src: 'https://a.example/x.png',
            alt: '',
            heading: '',
            text: '',
            buttonLabel: 'Go',
            buttonUrl: 'javascript:x',
          },
        ]),
      ),
    ).toHaveLength(1)
    expect(issues({ version: 2, blocks: [{ id: 'x', type: 'iframe' }], removed: [] })).toHaveLength(
      1,
    )
    expect(
      issues(
        v2([
          {
            id: 'c',
            type: 'columns',
            stack: true,
            cells: [[{ id: 'b', type: 'button', label: 'x', url: 'javascript:1' }], []],
          },
        ]),
      ),
    ).toHaveLength(1)
    expect(issues(v2([], { removed: ['items#0'] }))).toEqual(['items#0 cannot be removed'])
    expect(
      issues(
        v2([{ id: 'f', type: 'footer', social: true, links: [{ label: 'x', url: 'ftp://a' }] }]),
      ),
    ).toHaveLength(1)
    expect(checkEmailDesign({ ...defaultEmailDesign('delivered'), version: 1 }).ok).toBe(true)
  })

  it('cleans an HTML block when it is read', () => {
    const parsed = parseEmailDesign(
      v2([{ id: 'h', type: 'html', html: '<p onclick="x()">Hi<script>alert(1)</script></p>' }]),
    )
    expect(parsed?.blocks[0]).toMatchObject({ html: '<p>Hi</p>' })
  })
})

describe('sanitizeEmailHtml', () => {
  it('keeps email-safe HTML and strips everything that can run or load', () => {
    expect(sanitizeEmailHtml('<b>Bold</b> <a href="https://a.example">x</a>')).toBe(
      '<b>Bold</b> <a href="https://a.example" target="_blank" rel="noopener">x</a>',
    )
    expect(sanitizeEmailHtml('<a href="javascript:alert(1)">x</a>')).toBe(
      '<a target="_blank" rel="noopener">x</a>',
    )
    expect(sanitizeEmailHtml('<a href="&#106;avascript:alert(1)">x</a>')).not.toContain('href')
    expect(sanitizeEmailHtml('<img src="http://a.example/x.png" onerror="x">')).toBe('<img>')
    expect(
      sanitizeEmailHtml('<div style="color:red; background:url(x); position:fixed">a</div>'),
    ).toBe('<div style="color:red">a</div>')
    expect(sanitizeEmailHtml('<style>p{}</style><iframe src="x"></iframe><!-- c -->ok')).toBe('ok')
    expect(sanitizeEmailHtml('<p><b>open')).toBe('<p><b>open</b></p>')
    expect(sanitizeEmailHtml('</b>stray < text')).toBe('stray &lt; text')
    expect(sanitizeEmailHtml('<svg><script>x</script></svg>after')).toBe('after')
  })
})

describe('rich text', () => {
  it('reads bold, italic, links and lists, and refuses unsafe links', () => {
    expect(
      parseRichText('Hi **you** and *me* [shop](https://a.example) [bad](javascript:x)'),
    ).toEqual([
      {
        t: 'p',
        lines: [
          [
            { t: 'text', v: 'Hi ' },
            { t: 'b', c: [{ t: 'text', v: 'you' }] },
            { t: 'text', v: ' and ' },
            { t: 'i', c: [{ t: 'text', v: 'me' }] },
            { t: 'text', v: ' ' },
            { t: 'a', href: 'https://a.example', c: [{ t: 'text', v: 'shop' }] },
            { t: 'text', v: ' ' },
            { t: 'text', v: 'bad' },
          ],
        ],
      },
    ])
    expect(parseRichText('Intro\n- one\n- two\n\n1. first').map((b) => b.t)).toEqual([
      'p',
      'ul',
      'ol',
    ])
    expect(richToPlain('**Hi** [shop](https://a.example)\n- one')).toBe(
      'Hi shop (https://a.example)\n\n- one',
    )
  })
})

describe('email styles', () => {
  it('swaps the font, text colours and sizes, never backgrounds', () => {
    const html =
      '<td style="font-family:&#x27;Times New Roman&#x27;, Times, Tinos, Georgia, serif;color:#161615;background-color:#161615;font-size:15px;line-height:23px">x</td>'
    const out = applyDesignLook(html, { font: 'arial', heading: '#ff0000', size: 18 })
    expect(out).toContain('font-family:Arial, Helvetica, sans-serif')
    expect(out).toContain(';color:#ff0000')
    expect(out).toContain('background-color:#161615')
    expect(out).toContain('font-size:18px')
    expect(out).toContain('line-height:27.5px')
    expect(applyDesignLook(html, undefined)).toBe(html)
  })

  it('draws the page, card, width, button and accent from the styles', async () => {
    const d = defaultEmailDesign('order_placed')
    const email = await render('order_placed', {
      ...d,
      styles: {
        background: '#eeeeee',
        card: '#fafafa',
        width: 680,
        accent: '#0055aa',
        button: { background: '#aa0000', text: '#ffffff', shape: 'pill' },
      },
    })
    expect(email.html).toContain('background-color:#eeeeee')
    expect(email.html).toContain('background-color:#fafafa')
    expect(email.html).toContain('max-width:680px')
    expect(email.html).toContain('background-color:#aa0000')
    expect(email.html).toContain('border-radius:999px')
    expect(email.html).toContain('#0055aa')
  })
})

describe('order blocks with the merchant edits', () => {
  it('items: own title, hidden parts and colours, with the real lines', async () => {
    const sample = data('order_placed')
    const d = defaultEmailDesign('order_placed')
    const blocks = d.blocks.map(
      (b): DesignBlock =>
        b.type === 'slot' && b.slot === 'items#0'
          ? {
              ...b,
              edit: {
                texts: { title: 'Your bag, {{customer_name}}' },
                hide: ['image', 'price'],
                colours: { ink: '#123456' },
              },
            }
          : b,
    )
    const email = await render('order_placed', { ...d, blocks })
    expect(email.html).toContain(`Your bag, ${sample.customerName}`)
    expect(email.html).toContain(sample.lines[0]?.title.split(' / ')[0])
    expect(email.html).toContain('color:#123456')
    expect(email.html).not.toContain(sample.lines[0]?.imageUrl ?? 'no-image')
    expect(email.html).toContain(sample.totalLabel)
  })

  it('the main button: own label and style, same link', async () => {
    const d = defaultEmailDesign('order_placed')
    const button = d.blocks.find((b) => b.type === 'slot' && b.slot.startsWith('button#'))
    expect(button).toBeDefined()
    const blocks = d.blocks.map(
      (b): DesignBlock =>
        b === button && b.type === 'slot'
          ? {
              ...b,
              edit: {
                texts: { label: 'See it' },
                button: { background: '#00aa00', shape: 'square' },
              },
            }
          : b,
    )
    const email = await render('order_placed', { ...d, blocks })
    expect(email.html).toContain('See it')
    expect(email.html).toContain('background-color:#00aa00')
    expect(email.html).toContain('border-radius:0')
  })

  it('a box puts a background band and space around a block', async () => {
    const d = defaultEmailDesign('delivered')
    const blocks = d.blocks.map(
      (b): DesignBlock =>
        b.type === 'intro'
          ? { ...b, box: { background: '#fff3e0', top: 'large' }, align: 'left' }
          : b,
    )
    const email = await render('delivered', { ...d, blocks })
    expect(email.html).toContain('background-color:#fff3e0')
    expect(email.html).toContain('padding-top:44px')
    expect(email.html).toContain('text-align:left')
  })
})

describe('new blocks', () => {
  const base = defaultEmailDesign('delivered').blocks
  const withBlock = (b: DesignBlock) => v2([...base.slice(0, 2), b, ...base.slice(2)])

  it('hero: picture, heading, line and button', async () => {
    const email = await render(
      'delivered',
      withBlock({
        id: 'h',
        type: 'hero',
        src: 'https://cdn.example/hero.jpg',
        alt: 'Sale',
        heading: 'Big sale',
        text: 'Up to half off',
        buttonLabel: 'Shop now',
        buttonUrl: '{{shop_url}}',
      }),
    )
    expect(email.html).toContain('https://cdn.example/hero.jpg')
    expect(email.html).toContain('Big sale')
    expect(email.html).toContain('Shop now')
    expect(email.text).toContain('Shop now: ')
  })

  it('products: tiles with title, price and a link to the product', async () => {
    const email = await render(
      'delivered',
      withBlock({
        id: 'p',
        type: 'products',
        title: 'You may like',
        columns: 2,
        showPrice: true,
        buttonLabel: 'View',
        items: [
          {
            id: '1',
            title: 'Pad',
            priceLabel: '₹999',
            handle: 'pad',
            imageUrl: 'https://cdn.example/pad.jpg',
          },
          { id: '2', title: 'Mouse', priceLabel: '₹2,499', handle: 'mouse' },
        ],
      }),
    )
    expect(email.html).toContain('You may like')
    expect(email.html).toContain('/products/pad')
    expect(email.html).toContain('₹2,499')
    expect(email.html).toContain('k-stack')
  })

  it('coupon, video, divider colour and spacer', async () => {
    const email = await render(
      'delivered',
      v2([
        ...base,
        {
          id: 'c',
          type: 'coupon',
          code: 'WELCOME10',
          label: 'Your code',
          note: 'Ends Sunday',
          value: '10%',
          valueNote: 'OFF',
        },
        {
          id: 'v',
          type: 'video',
          src: 'https://cdn.example/thumb.jpg',
          url: 'https://youtu.be/x',
          alt: 'Watch',
          label: 'Watch the unboxing',
        },
        { id: 'd', type: 'divider', label: '', colour: '#00ff00' },
      ]),
    )
    expect(email.html).toContain('WELCOME10')
    expect(email.html).toContain('Watch the unboxing')
    expect(email.html).toContain('https://youtu.be/x')
    expect(email.html).toContain('#00ff00')
    expect(email.text).toContain('Your code: WELCOME10')
  })

  it('HTML: cleaned again after the variables are filled', async () => {
    const email = await render(
      'delivered',
      v2([...base, { id: 'h', type: 'html', html: '<p>Hi <b>{{customer_name}}</b></p>' }]),
      { customerName: '<script>x</script>' },
    )
    expect(email.html).toContain('<b>&lt;script&gt;x&lt;/script&gt;</b>')
    expect(email.html).not.toContain('<script>x')
  })

  it('columns: cells side by side in table cells that stack on phones, no flex or grid', async () => {
    const email = await render(
      'delivered',
      v2([
        ...base,
        {
          id: 'c',
          type: 'columns',
          stack: true,
          cells: [
            [{ id: 'a', type: 'heading', text: 'Left side', size: 'small' }],
            [
              {
                id: 'b',
                type: 'text',
                text: '**Right** side',
                align: 'left',
                muted: false,
                rich: true,
              },
            ],
            [{ id: 'e', type: 'button', label: 'Go', url: '{{shop_url}}' }],
          ],
        },
      ]),
    )
    expect(email.html).toContain('Left side')
    expect(email.html).toContain('<strong>')
    expect(email.html).toContain('width:33%')
    expect(email.html).not.toMatch(/display:\s*(flex|grid)/)
  })

  it('rich text, help box and footer words', async () => {
    const email = await render(
      'delivered',
      v2([
        { id: 'logo', type: 'logo', menu: true },
        {
          id: 't',
          type: 'text',
          text: 'Hello **{{customer_name}}**\n- fast\n- free',
          align: 'left',
          muted: false,
          rich: true,
        },
        {
          id: 'help',
          type: 'help',
          title: 'Need a hand?',
          body: 'Write to us any time.',
          whatsapp: false,
        },
        {
          id: 'footer',
          type: 'footer',
          social: false,
          note: 'Sent with love',
          address: false,
          links: [{ label: 'Returns', url: '{{shop_url}}/returns' }],
        },
      ]),
    )
    expect(email.html).toContain('<ul')
    expect(email.html).toContain('Need a hand?')
    expect(email.html).toContain('Write to us any time.')
    expect(email.html).toContain('Sent with love')
    expect(email.html).toContain('/returns')
    expect(email.text).toContain('- fast')
  })
})

describe('Email branding styles', () => {
  it('apply to every email, built-in or designed, with the design on top', async () => {
    const brand = {
      ...sampleEmailBrand,
      styles: { font: 'verdana' as const, background: '#101010' },
    }
    const plain = await renderEmail('delivered', { ...data('delivered'), brand })
    expect(plain.html).toContain('Verdana, Geneva, sans-serif')
    expect(plain.html).toContain('background-color:#101010')
    const designed = await renderEmail('delivered', {
      ...data('delivered'),
      brand,
      design: { ...defaultEmailDesign('delivered'), styles: { font: 'georgia' } },
    })
    expect(designed.html).toContain('Georgia, Times, serif')
    expect(designed.html).toContain('background-color:#101010')
  })
})
