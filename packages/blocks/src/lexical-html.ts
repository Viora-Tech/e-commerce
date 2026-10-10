import {
  IS_BOLD,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_UNDERLINE,
  isYouTubeId,
  type RichTextValue,
  type SerializedNode,
  sanitizeHref,
  sanitizeImageSrc,
} from '@commerce/richtext'

/**
 * SOURCE OF TRUTH KEYWORDS: lexicalToHtml, asLexical, richtextFromLexical, Lexical migration
 * WHAT:  Reads section body copy saved by the old Lexical rich-text field (JSON, as an object
 *        or a JSON string) and writes it as the HTML Puck's `richtext` field stores.
 * WHY:   Sections keep one rich-text store: Tiptap HTML (`./richtext-html.ts`). Theme docs saved
 *        before that still hold Lexical JSON in the same props, so nothing is rewritten in the
 *        database: the storefront converts on read (`richtextHtml`), and the admin converts
 *        when Customize loads a template (`richtextFromLexical` in `normalizeDoc`), so the next
 *        save stores HTML. Only what the richtext allow-list keeps is written: paragraphs,
 *        headings (h2 to h4), quotes, lists, links, line breaks, rules, images and B/I/U/S.
 *        Nothing the merchant wrote is lost: a YouTube embed becomes a link to the video;
 *        tables, code and collapsibles keep their text. Only alignment and indents are dropped.
 * WHERE: `./richtext-html.ts` (storefront and canvas render), `apps/admin/src/lib/customize-doc.ts`.
 */

/** A stored value as a Lexical document, or null when it is anything else. */
export function asLexical(value: unknown): RichTextValue | null {
  let parsed = value
  if (typeof value === 'string') {
    if (!value.trimStart().startsWith('{')) return null
    try {
      parsed = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!parsed || typeof parsed !== 'object') return null
  const root = (parsed as { root?: unknown }).root
  return root && typeof root === 'object' && (root as SerializedNode).type === 'root'
    ? (parsed as RichTextValue)
    : null
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Text with its B/I/U/S marks, innermost first so the tags nest the way Tiptap writes them. */
function textHtml(node: SerializedNode): string {
  const format = typeof node.format === 'number' ? node.format : 0
  let html = escapeHtml(typeof node.text === 'string' ? node.text : '')
  if (format & IS_STRIKETHROUGH) html = `<s>${html}</s>`
  if (format & IS_UNDERLINE) html = `<u>${html}</u>`
  if (format & IS_ITALIC) html = `<em>${html}</em>`
  if (format & IS_BOLD) html = `<strong>${html}</strong>`
  return html
}

function plainText(node: SerializedNode): string {
  if (typeof node.text === 'string') return escapeHtml(node.text)
  if (node.type === 'linebreak') return '<br>'
  return (node.children ?? []).map(plainText).join('')
}

/** An `<img>` the Customize image extension and the allow-list both keep; nothing for an unsafe source. */
function imageHtml(node: SerializedNode): string {
  const src = sanitizeImageSrc(typeof node.src === 'string' ? node.src : '')
  if (!src) return ''
  const alt = typeof node.altText === 'string' ? node.altText : ''
  const width =
    typeof node.width === 'number' && node.width > 0 ? ` width="${Math.round(node.width)}"` : ''
  const height =
    typeof node.height === 'number' && node.height > 0 ? ` height="${Math.round(node.height)}"` : ''
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${width}${height}>`
}

/** Section copy never embeds players, so a saved YouTube video becomes a link to it. */
function youtubeLink(id: string): string {
  const url = `https://www.youtube.com/watch?v=${id}`
  return `<p><a href="${url}">${url}</a></p>`
}

function headingTag(tag: unknown): string {
  if (tag === 'h3') return 'h3'
  if (tag === 'h4' || tag === 'h5' || tag === 'h6') return 'h4'
  return 'h2'
}

function nodeHtml(node: SerializedNode): string {
  const inner = () => (node.children ?? []).map(nodeHtml).join('')
  switch (node.type) {
    case 'text':
      return textHtml(node)
    case 'linebreak':
      return '<br>'
    case 'tab':
      return ' '
    case 'paragraph':
      return `<p>${inner() || '<br>'}</p>`
    case 'heading': {
      const tag = headingTag(node.tag)
      return `<${tag}>${inner()}</${tag}>`
    }
    case 'quote':
      return `<blockquote><p>${inner()}</p></blockquote>`
    case 'list': {
      const tag = node.listType === 'number' ? 'ol' : 'ul'
      return `<${tag}>${inner()}</${tag}>`
    }
    case 'listitem':
      return `<li>${inner()}</li>`
    case 'link':
    case 'autolink': {
      const href = sanitizeHref(typeof node.url === 'string' ? node.url : '')
      if (!href) return inner()
      const target = node.target === '_blank' ? ' target="_blank" rel="noopener noreferrer"' : ''
      return `<a href="${escapeHtml(href)}"${target}>${inner()}</a>`
    }
    case 'horizontalrule':
      return '<hr>'
    case 'code':
      return `<p>${plainText(node)}</p>`
    case 'tablerow':
      return `<p>${(node.children ?? []).map(plainText).join(' · ')}</p>`
    case 'collapsible-title':
      return `<p><strong>${plainText(node)}</strong></p>`
    case 'image':
      return imageHtml(node)
    case 'youtube':
      return isYouTubeId(node.videoID) ? youtubeLink(node.videoID) : ''
    default:
      return inner()
  }
}

/** A Lexical document as richtext HTML (not yet sanitised; `richtextHtml` does that). */
export function lexicalToHtml(value: RichTextValue): string {
  return (value.root.children ?? []).map(nodeHtml).join('')
}

/**
 * A section's props (or any value inside them, slots included) with every Lexical rich-text
 * value swapped for its HTML. Anything else is returned as it was, the same object when
 * nothing changed.
 */
export function richtextFromLexical<T>(value: T): T {
  const lexical = asLexical(value)
  if (lexical) return lexicalToHtml(lexical) as T
  if (Array.isArray(value)) {
    const next = value.map(richtextFromLexical)
    return (next.some((v, i) => v !== value[i]) ? next : value) as T
  }
  if (value && typeof value === 'object') {
    let changed = false
    const next: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value)) {
      next[key] = richtextFromLexical(v)
      if (next[key] !== v) changed = true
    }
    return (changed ? next : value) as T
  }
  return value
}
