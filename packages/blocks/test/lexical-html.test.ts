import type { RichTextValue, SerializedNode } from '@commerce/richtext'
import { describe, expect, it } from 'vitest'
import { asLexical, lexicalToHtml, richtextFromLexical } from '../src/lexical-html'
import { richtextHtml } from '../src/richtext-html'

type Node = SerializedNode

// Nodes in the exact shape the retired Lexical field (`@commerce/editor`) saved them.
const el = (type: string, children: Node[], extra: Record<string, unknown> = {}): Node => ({
  type,
  format: '',
  indent: 0,
  direction: 'ltr',
  version: 1,
  children,
  ...extra,
})
const text = (t: string, format = 0): Node => ({
  type: 'text',
  text: t,
  format,
  detail: 0,
  mode: 'normal',
  style: '',
  version: 1,
})
const doc = (...children: Node[]): RichTextValue => ({ root: el('root', children) })

/** A Rich text section body as the old editor saved it: touches every node it could make. */
const saved = doc(
  el('heading', [text('Waimers Glasspad')], { tag: 'h2' }),
  el('paragraph', [text('Fast, '), text('smooth', 1), text(' and '), text('quiet', 2), text('.')], {
    textFormat: 0,
    textStyle: '',
  }),
  el('paragraph', [], { format: 'center' }),
  el('paragraph', [
    el('link', [text('Read the guide')], { url: 'https://waimers.in/guide', target: '_blank' }),
    { type: 'linebreak', version: 1 },
    el('link', [text('bad')], { url: 'javascript:alert(1)' }),
  ]),
  el(
    'list',
    [
      el('listitem', [text('Glass surface')], { value: 1 }),
      el(
        'listitem',
        [el('list', [el('listitem', [text('4mm')], { value: 1 })], { listType: 'bullet' })],
        { value: 2 },
      ),
    ],
    { listType: 'bullet', tag: 'ul' },
  ),
  el('list', [el('listitem', [text('Step one')], { value: 1 })], { listType: 'number', tag: 'ol' }),
  el('list', [el('listitem', [text('Done')], { value: 1, checked: true })], { listType: 'check' }),
  el('quote', [text('Best pad I have used.')]),
  { type: 'horizontalrule', version: 1 },
  { type: 'image', src: 'https://cdn.waimers.in/pad.jpg', altText: 'Pad', version: 1 },
  { type: 'youtube', videoID: 'dQw4w9WgXcQ', version: 1 },
  el('collapsible-container', [
    el('collapsible-title', [text('Specs')]),
    el('collapsible-content', [el('paragraph', [text('490 x 420 mm')])]),
  ]),
  el('table', [
    el('tablerow', [
      el('tablecell', [el('paragraph', [text('Size')])], { headerState: 1 }),
      el('tablecell', [el('paragraph', [text('XL')])], { headerState: 0 }),
    ]),
  ]),
  el('code', [{ type: 'code-highlight', text: 'const', version: 1 }, text(' x = 1 < 2')]),
  el('heading', [text('Small print'), text(' & more', 8 | 4)], { tag: 'h5' }),
)

describe('asLexical', () => {
  it('reads a Lexical document saved as an object or as a JSON string', () => {
    expect(asLexical(saved)).toBe(saved)
    expect(asLexical(JSON.stringify(saved))).toEqual(saved)
  })

  it('leaves everything else alone', () => {
    expect(asLexical('<p>Hi</p>')).toBeNull()
    expect(asLexical('{ not json')).toBeNull()
    expect(asLexical({ root: {} })).toBeNull()
    expect(asLexical({ root: { props: {} } })).toBeNull()
    expect(asLexical(null)).toBeNull()
  })
})

describe('lexicalToHtml', () => {
  const html = richtextHtml(saved)

  it('keeps paragraphs, marks and blank lines', () => {
    expect(html).toContain('<p>Fast, <strong>smooth</strong> and <em>quiet</em>.</p><p><br /></p>')
  })

  it('keeps headings within h2 to h4, quotes and rules', () => {
    expect(html.startsWith('<h2>Waimers Glasspad</h2>')).toBe(true)
    expect(html).toContain('<blockquote><p>Best pad I have used.</p></blockquote><hr />')
    expect(html).toContain('<h4>Small print<u><s> &amp; more</s></u></h4>')
  })

  it('keeps safe links and drops unsafe ones to their text', () => {
    expect(html).toContain(
      '<a href="https://waimers.in/guide" target="_blank" rel="noopener noreferrer">Read the guide</a><br />bad</p>',
    )
    expect(html).not.toContain('javascript')
  })

  it('keeps lists, nested ones included', () => {
    expect(html).toContain('<ul><li>Glass surface</li><li><ul><li>4mm</li></ul></li></ul>')
    expect(html).toContain('<ol><li>Step one</li></ol><ul><li>Done</li></ul>')
  })

  it('keeps the text of tables, code and collapsibles', () => {
    expect(html).toContain('<p>Size · XL</p>')
    expect(html).toContain('<p>const x = 1 &lt; 2</p>')
    expect(html).toContain('<p><strong>Specs</strong></p><p>490 x 420 mm</p>')
  })

  it('keeps images, and turns a YouTube embed into a link to the video', () => {
    expect(html).toContain(
      '<hr /><img src="https://cdn.waimers.in/pad.jpg" alt="Pad" loading="lazy" decoding="async" />',
    )
    expect(html).toContain(
      '<p><a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">https://www.youtube.com/watch?v=dQw4w9WgXcQ</a></p>',
    )
    expect(html).not.toContain('iframe')
  })

  it('keeps an image inline in its paragraph, with its size and our root-relative media paths', () => {
    const inline = doc(
      el('paragraph', [
        text('See '),
        {
          type: 'image',
          src: '/media/store/pad.webp',
          altText: 'Pad "XL"',
          width: 480,
          height: 320.4,
          version: 1,
        },
      ]),
    )
    expect(richtextHtml(inline)).toBe(
      '<p>See <img src="/media/store/pad.webp" alt="Pad &quot;XL&quot;" width="480" height="320" loading="lazy" decoding="async" /></p>',
    )
  })

  it('drops only what was never safe to show: data: or script images and bad video ids', () => {
    const unsafe = doc(
      { type: 'image', src: 'data:image/png;base64,AAAA', altText: 'evil', version: 1 },
      { type: 'image', src: 'javascript:alert(1)', altText: 'evil', version: 1 },
      { type: 'youtube', videoID: '"><script>', version: 1 },
      el('paragraph', [text('Kept')]),
    )
    expect(richtextHtml(unsafe)).toBe('<p>Kept</p>')
  })

  it('needs no sanitising to be safe: text is escaped as it is written', () => {
    const evil = doc(el('paragraph', [text('<script>alert(1)</script>')]))
    expect(lexicalToHtml(evil)).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
  })
})

describe('richtextFromLexical', () => {
  it('swaps Lexical values for HTML anywhere in a section, slots included', () => {
    const props = {
      heading: 'Our story',
      body: saved,
      content: [
        {
          type: 'Text',
          props: { id: 'text-1', body: JSON.stringify(doc(el('paragraph', [text('Hi')]))) },
        },
      ],
    }
    const next = richtextFromLexical(props)
    expect(next.heading).toBe('Our story')
    expect(next.body).toBe(lexicalToHtml(saved))
    expect(next.content[0]?.props.body).toBe('<p>Hi</p>')
  })

  it('returns the same object when there is nothing to convert', () => {
    const props = { heading: 'Hi', body: '<p>Already HTML</p>', items: [{ title: 'A' }] }
    expect(richtextFromLexical(props)).toBe(props)
  })
})
