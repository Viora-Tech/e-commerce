/** SOURCE OF TRUTH: rich text for Liquid — WHAT: our rich text (Lexical JSON) as an HTML string for `product.description`, `article.content` and friends, built by hand from the node tree / WHY: the storefront renders imported themes inside React Server Components, where `react-dom/server` (what `@commerce/richtext/html` uses) may not be imported; this keeps to plain strings and escapes every text and URL */

type Node = {
  type?: string
  tag?: string
  text?: string
  format?: number | string
  url?: string
  listType?: string
  src?: string
  altText?: string
  children?: Node[]
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Only web and mail links; anything else (javascript:, data:) becomes `#`. */
const safeUrl = (url: string) =>
  /^(https?:|mailto:|tel:|\/(?!\/)|#)/i.test(url.trim()) ? url : '#'

const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

/** Lexical text format bits: bold 1, italic 2, strikethrough 4, underline 8, code 16. */
function formatText(node: Node): string {
  let html = escapeHtml(node.text ?? '')
  const f = typeof node.format === 'number' ? node.format : 0
  if (f & 16) html = `<code>${html}</code>`
  if (f & 1) html = `<strong>${html}</strong>`
  if (f & 2) html = `<em>${html}</em>`
  if (f & 4) html = `<s>${html}</s>`
  if (f & 8) html = `<u>${html}</u>`
  return html
}

function renderNode(node: Node): string {
  const inner = () => (node.children ?? []).map(renderNode).join('')
  switch (node.type) {
    case 'root':
      return inner()
    case 'text':
      return formatText(node)
    case 'linebreak':
      return '<br>'
    case 'paragraph':
      return `<p>${inner()}</p>`
    case 'heading': {
      const tag = node.tag && HEADINGS.has(node.tag) ? node.tag : 'h2'
      return `<${tag}>${inner()}</${tag}>`
    }
    case 'quote':
      return `<blockquote>${inner()}</blockquote>`
    case 'list': {
      const tag = node.listType === 'number' ? 'ol' : 'ul'
      return `<${tag}>${inner()}</${tag}>`
    }
    case 'listitem':
      return `<li>${inner()}</li>`
    case 'link':
    case 'autolink':
      return `<a href="${escapeHtml(safeUrl(node.url ?? '#'))}">${inner()}</a>`
    case 'image':
      return node.src
        ? `<img src="${escapeHtml(safeUrl(node.src))}" alt="${escapeHtml(node.altText ?? '')}">`
        : ''
    default:
      return inner()
  }
}

/** Our rich text as HTML; a plain string becomes one escaped paragraph. */
export function richTextHtml(value: unknown): string {
  if (typeof value === 'string') return value ? `<p>${escapeHtml(value)}</p>` : ''
  if (!value || typeof value !== 'object') return ''
  const root = (value as { root?: Node }).root
  return root ? renderNode(root) : ''
}
