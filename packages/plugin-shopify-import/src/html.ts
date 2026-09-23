/**
 * Shopify body HTML → Lexical JSON, the shape `@commerce/richtext` renders.
 * A small tokenizer, not a browser parser: it keeps paragraphs, headings,
 * lists, quotes, links, bold/italic/underline, line breaks and images, and
 * drops everything else (scripts, styles, iframes, inline CSS). Images are
 * returned too, so the importer can re-host them and swap the URLs.
 */

type LexNode = Record<string, unknown> & { type: string }
export type RichText = { root: LexNode }

const BOLD = 1
const ITALIC = 2
const STRIKE = 4
const UNDERLINE = 8

const BLOCK_TAGS = new Set([
  'p',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'section',
  'article',
  'table',
  'tr',
])
const DROP_TAGS = new Set(['script', 'style', 'iframe', 'noscript', 'svg', 'template', 'head'])

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '-',
  mdash: '-',
  hellip: '...',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  rupee: '₹',
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n =
        code[1] === 'x' || code[1] === 'X'
          ? Number.parseInt(code.slice(2), 16)
          : Number.parseInt(code.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m
    }
    return ENTITIES[code.toLowerCase()] ?? m
  })
}

type Token =
  | { kind: 'open'; tag: string; attrs: Record<string, string>; selfClosing: boolean }
  | { kind: 'close'; tag: string }
  | { kind: 'text'; text: string }

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /([a-z_:][-a-z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gi
  for (const m of raw.matchAll(re)) {
    const name = m[1]?.toLowerCase()
    if (name) attrs[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '')
  }
  return attrs
}

function tokenize(html: string): Token[] {
  const tokens: Token[] = []
  const re = /<!--[\s\S]*?-->|<(\/?)([a-z][a-z0-9]*)\b([^>]*?)(\/?)>|([^<]+)|</gi
  for (const m of html.matchAll(re)) {
    if (m[0].startsWith('<!--')) continue
    if (m[5] !== undefined) {
      tokens.push({ kind: 'text', text: m[5] })
      continue
    }
    if (!m[2]) {
      tokens.push({ kind: 'text', text: '<' })
      continue
    }
    const tag = m[2].toLowerCase()
    if (m[1]) tokens.push({ kind: 'close', tag })
    else
      tokens.push({
        kind: 'open',
        tag,
        attrs: parseAttrs(m[3] ?? ''),
        selfClosing: m[4] === '/' || tag === 'br' || tag === 'img' || tag === 'hr',
      })
  }
  return tokens
}

const textNode = (text: string, format: number): LexNode => ({
  type: 'text',
  text,
  format,
  style: '',
  mode: 'normal',
  detail: 0,
  version: 1,
})

const element = (type: string, children: LexNode[], extra: Record<string, unknown> = {}) => ({
  type,
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
  ...extra,
})

export type HtmlConversion = { doc: RichText | null; images: { src: string; alt: string }[] }

/** Convert. Returns a null document for empty or whitespace-only HTML. */
export function htmlToRichText(html: string | null | undefined): HtmlConversion {
  const images: { src: string; alt: string }[] = []
  if (!html?.trim()) return { doc: null, images }
  const blocks: LexNode[] = []
  // Inline runs collect here until a block boundary flushes them.
  let inline: LexNode[] = []
  let blockType: { type: 'paragraph' | 'heading' | 'quote'; tag?: string } = { type: 'paragraph' }
  const formats: number[] = []
  let link: LexNode | null = null
  let dropDepth = 0
  const lists: { node: LexNode; items: LexNode[] }[] = []
  let listItem: LexNode[] | null = null

  const format = () => formats.reduce((a, b) => a | b, 0)
  const pushInline = (node: LexNode) => {
    if (link) (link.children as LexNode[]).push(node)
    else inline.push(node)
  }
  const flush = () => {
    const meaningful = inline.some(
      (n) => n.type !== 'text' || String((n as { text?: string }).text ?? '').trim() !== '',
    )
    if (meaningful) {
      // Trim the whitespace HTML indentation leaves at the edges of a block.
      const first = inline[0]
      if (first?.type === 'text') first.text = String(first.text).replace(/^\s+/, '')
      const last = inline.at(-1)
      if (last?.type === 'text') last.text = String(last.text).replace(/\s+$/, '')
      if (listItem) listItem.push(...inline)
      else if (blockType.type === 'heading')
        blocks.push(element('heading', inline, { tag: blockType.tag }))
      else blocks.push(element(blockType.type, inline))
    }
    inline = []
  }

  for (const token of tokenize(html)) {
    if (token.kind === 'open' && DROP_TAGS.has(token.tag)) {
      if (!token.selfClosing) dropDepth++
      continue
    }
    if (token.kind === 'close' && DROP_TAGS.has(token.tag)) {
      dropDepth = Math.max(0, dropDepth - 1)
      continue
    }
    if (dropDepth > 0) continue

    if (token.kind === 'text') {
      const text = decodeEntities(token.text).replace(/\s+/g, ' ')
      if (text) pushInline(textNode(text, format()))
      continue
    }

    const tag = token.tag
    if (token.kind === 'open') {
      if (tag === 'br') {
        pushInline({ type: 'linebreak', version: 1 })
      } else if (tag === 'img') {
        const src = token.attrs.src ?? ''
        if (src) {
          images.push({ src, alt: token.attrs.alt ?? '' })
          flush()
          blocks.push(
            element('paragraph', [
              {
                type: 'image',
                src,
                altText: token.attrs.alt ?? '',
                version: 1,
                showCaption: false,
              },
            ]),
          )
        }
      } else if (tag === 'hr') {
        flush()
        blocks.push({ type: 'horizontalrule', version: 1 })
      } else if (tag === 'strong' || tag === 'b') formats.push(BOLD)
      else if (tag === 'em' || tag === 'i') formats.push(ITALIC)
      else if (tag === 'u') formats.push(UNDERLINE)
      else if (tag === 's' || tag === 'strike' || tag === 'del') formats.push(STRIKE)
      else if (tag === 'a') {
        const href = token.attrs.href ?? ''
        if (href && !link) {
          link = element('link', [], { url: href, rel: null, target: null, title: null })
          inline.push(link)
        }
      } else if (tag === 'ul' || tag === 'ol') {
        flush()
        const node = element('list', [], {
          listType: tag === 'ol' ? 'number' : 'bullet',
          start: 1,
          tag,
        })
        lists.push({ node, items: [] })
      } else if (tag === 'li') {
        flush()
        listItem = []
      } else if (/^h[1-6]$/.test(tag)) {
        flush()
        blockType = { type: 'heading', tag }
      } else if (tag === 'blockquote') {
        flush()
        blockType = { type: 'quote' }
      } else if (BLOCK_TAGS.has(tag)) {
        flush()
      }
      continue
    }

    // Closing tags.
    if (tag === 'strong' || tag === 'b' || tag === 'em' || tag === 'i' || tag === 'u') {
      formats.pop()
    } else if (tag === 's' || tag === 'strike' || tag === 'del') formats.pop()
    else if (tag === 'a') link = null
    else if (tag === 'li') {
      flush()
      const list = lists.at(-1)
      if (list && listItem) {
        const value = list.items.length + 1
        list.items.push(element('listitem', listItem, { value }))
      }
      listItem = null
    } else if (tag === 'ul' || tag === 'ol') {
      flush()
      const list = lists.pop()
      if (list && list.items.length > 0) {
        list.node.children = list.items
        const parent = lists.at(-1)
        if (parent) {
          const lastItem = parent.items.at(-1)
          if (lastItem) (lastItem.children as LexNode[]).push(list.node)
        } else blocks.push(list.node)
      }
    } else if (/^h[1-6]$/.test(tag) || tag === 'blockquote') {
      flush()
      blockType = { type: 'paragraph' }
    } else if (BLOCK_TAGS.has(tag)) {
      flush()
    }
  }
  flush()
  while (lists.length) {
    const list = lists.shift()
    if (list?.items.length) {
      list.node.children = list.items
      blocks.push(list.node)
    }
  }
  if (blocks.length === 0) return { doc: null, images }
  return { doc: { root: element('root', blocks) }, images }
}

/** Swap image URLs in a converted document (after re-hosting). */
export function replaceImageSources(doc: RichText | null, map: Map<string, string>): void {
  if (!doc) return
  const walk = (node: LexNode) => {
    if (node.type === 'image' && typeof node.src === 'string') {
      const next = map.get(node.src)
      if (next) node.src = next
    }
    const children = node.children as LexNode[] | undefined
    if (Array.isArray(children)) for (const child of children) walk(child)
  }
  walk(doc.root)
}

/** Plain text of some HTML, for excerpts and SEO descriptions. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return ''
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim()
}
