import type { RichTextValue, SerializedNode } from '../src/types'

const el = (
  type: string,
  children: SerializedNode[],
  extra: Record<string, unknown> = {},
): SerializedNode => ({
  type,
  format: '',
  indent: 0,
  direction: 'ltr',
  version: 1,
  children,
  ...extra,
})

const text = (t: string, format = 0): SerializedNode => ({
  type: 'text',
  text: t,
  format,
  detail: 0,
  mode: 'normal',
  style: '',
  version: 1,
})

/** One document that touches every converter. */
export const fixture: RichTextValue = {
  root: el('root', [
    el('heading', [text('Waimers Glasspad')], { tag: 'h2' }),
    el('paragraph', [
      text('Fast, '),
      text('smooth', 1),
      text(' and '),
      text('quiet', 2),
      text('.'),
    ]),
    el('paragraph', [], { format: 'center' }),
    el('paragraph', [
      el('link', [text('Read the guide')], { url: 'https://waimers.in/guide', target: '_blank' }),
    ]),
    el('paragraph', [el('link', [text('bad')], { url: 'javascript:alert(1)' })]),
    el(
      'list',
      [
        el('listitem', [text('Glass surface')], { value: 1 }),
        el(
          'listitem',
          [
            el('list', [el('listitem', [text('4mm')], { value: 1 })], {
              listType: 'bullet',
              tag: 'ul',
            }),
          ],
          {
            value: 2,
          },
        ),
      ],
      { listType: 'bullet', tag: 'ul' },
    ),
    el('list', [el('listitem', [text('Done')], { value: 1, checked: true })], {
      listType: 'check',
      tag: 'ul',
    }),
    el('quote', [text('Best pad I have used.')]),
    { type: 'horizontalrule', version: 1 },
    {
      type: 'image',
      src: 'https://cdn.waimers.in/pad.jpg',
      altText: 'Pad',
      width: 480,
      showCaption: true,
      version: 1,
    },
    { type: 'image', src: 'data:image/png;base64,AAAA', altText: 'evil', version: 1 },
    { type: 'youtube', videoID: 'dQw4w9WgXcQ', version: 1 },
    { type: 'youtube', videoID: '"><script>', version: 1 },
    el(
      'collapsible-container',
      [
        el('collapsible-title', [text('Specs')]),
        el('collapsible-content', [el('paragraph', [text('490 x 420 mm')])]),
      ],
      { open: false },
    ),
    el('table', [
      el('tablerow', [el('tablecell', [el('paragraph', [text('Size')])], { headerState: 1 })]),
      el('tablerow', [
        el('tablecell', [el('paragraph', [text('XL')])], {
          headerState: 0,
          backgroundColor: 'url(x)',
        }),
      ]),
    ]),
    el(
      'code',
      [
        { type: 'code-highlight', text: 'const', highlightType: 'keyword', version: 1 },
        text(' x = 1'),
      ],
      {
        language: 'ts',
      },
    ),
  ]),
}
