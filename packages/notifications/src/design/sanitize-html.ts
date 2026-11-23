/**
 * The HTML block's cleaner: a strict allow-list for email HTML, run on save and again on every
 * send. Pure and dependency-free so the admin's editor and the API share it. Kept: text, simple
 * formatting, links (http, https, mailto), https images and layout tables; inline `style` with
 * plain declarations only. Dropped: scripts, styles, frames, forms, event handlers, `url()` and
 * expressions in styles, comments, and any tag or attribute not listed here.
 */

const TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'center',
  'div',
  'em',
  'font',
  'h1',
  'h2',
  'h3',
  'h4',
  'hr',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
])

const VOID = new Set(['br', 'hr', 'img'])

/** Tags whose whole content goes with them. */
const DROP_WITH_CONTENT = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'noscript',
  'template',
  'svg',
  'math',
  'head',
  'title',
  'textarea',
  'select',
  'form',
  'button',
  'video',
  'audio',
])

const COMMON = ['style', 'align', 'dir', 'title']
const ATTRS: Record<string, string[]> = {
  a: ['href'],
  img: ['src', 'alt', 'width', 'height'],
  table: ['width', 'cellpadding', 'cellspacing', 'border', 'bgcolor', 'role'],
  td: ['width', 'colspan', 'rowspan', 'valign', 'bgcolor'],
  th: ['width', 'colspan', 'rowspan', 'valign', 'bgcolor'],
  font: ['color', 'size', 'face'],
}

const TAG = /<!--[\s\S]*?(?:-->|$)|<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g
const ATTR = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

const escapeText = (s: string) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttr = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Entities decoded so `&#106;avascript:` is checked as what a browser would read. */
function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);?/gi, (_m, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&colon;/gi, ':')
    .replace(/&tab;|&newline;/gi, '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

const SAFE_HREF = /^(https?:\/\/[^\s"'<>]+|mailto:[^\s"'<>]+|\{\{\s*[a-z_]+\s*\}\}[^\s"'<>]*)$/i
const SAFE_SRC = /^https:\/\/[^\s"'<>]+$/i
const BAD_STYLE = /url\s*\(|expression|javascript:|vbscript:|@import|behavior|-moz-binding|\\|<|>/i
const BAD_PROPS = new Set(['position', 'z-index', 'content'])

/** Plain `name: value` declarations; anything that could load or run something goes. */
function cleanStyle(style: string): string {
  return style
    .split(';')
    .map((d) => d.trim())
    .filter((d) => {
      const i = d.indexOf(':')
      if (i <= 0) return false
      const prop = d.slice(0, i).trim().toLowerCase()
      return /^[a-z-]+$/.test(prop) && !BAD_PROPS.has(prop) && !BAD_STYLE.test(d)
    })
    .join('; ')
}

function cleanAttrs(tag: string, raw: string): string {
  const allowed = new Set([...COMMON, ...(ATTRS[tag] ?? [])])
  const out: string[] = []
  for (const m of raw.matchAll(ATTR)) {
    const name = (m[1] ?? '').toLowerCase()
    if (!allowed.has(name)) continue
    let value = decode(m[2] ?? m[3] ?? m[4] ?? '')
      // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters hide schemes
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim()
    if (name === 'href' && !SAFE_HREF.test(value)) continue
    if (name === 'src' && !SAFE_SRC.test(value)) continue
    if (name === 'style') value = cleanStyle(value)
    if (name !== 'href' && name !== 'src' && /javascript:|vbscript:|data:/i.test(value)) continue
    if (value === '' && name !== 'alt') continue
    out.push(`${name}="${escapeAttr(value)}"`)
  }
  if (tag === 'a') out.push('target="_blank"', 'rel="noopener"')
  return out.length > 0 ? ` ${out.join(' ')}` : ''
}

/** The HTML with only what an email may carry; tags are balanced. */
export function sanitizeEmailHtml(html: string, max = Number.POSITIVE_INFINITY): string {
  const input = html.slice(0, max)
  const out: string[] = []
  const open: string[] = []
  let dropping: string | null = null
  let last = 0
  for (const m of input.matchAll(TAG)) {
    const at = m.index ?? 0
    if (!dropping) out.push(escapeText(input.slice(last, at)))
    last = at + m[0].length
    if (!m[2]) continue // a comment
    const closing = m[1] === '/'
    const tag = m[2].toLowerCase()
    if (dropping) {
      if (closing && tag === dropping) dropping = null
      continue
    }
    if (DROP_WITH_CONTENT.has(tag)) {
      if (!closing && !/\/\s*$/.test(m[3] ?? '')) dropping = tag
      continue
    }
    if (!TAGS.has(tag)) continue
    if (closing) {
      const i = open.lastIndexOf(tag)
      if (i === -1) continue
      // Close whatever was left open inside it.
      while (open.length > i) out.push(`</${open.pop()}>`)
      continue
    }
    out.push(`<${tag}${cleanAttrs(tag, m[3] ?? '')}>`)
    if (!VOID.has(tag)) open.push(tag)
  }
  if (!dropping) out.push(escapeText(input.slice(last)))
  while (open.length > 0) out.push(`</${open.pop()}>`)
  return out.join('')
}
