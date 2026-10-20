import type { ArticleStatus } from './schemas'

/**
 * Pure blog helpers shared by the admin editor, the storefront and the service.
 * No database, no React: safe in client components via `@commerce/core/blog`.
 */

type LexicalNode = { type?: string; text?: string; children?: LexicalNode[] }

const BLOCK_TYPES = new Set(['paragraph', 'heading', 'quote', 'listitem', 'code'])

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/**
 * The words of an HTML body (a Shopify import keeps its article HTML as a string): block
 * tags become line breaks, every other tag goes, and the common entities are decoded.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?(p|div|h[1-6]|li|blockquote|br)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (whole, code: string) => {
      if (code[0] !== '#') return ENTITIES[code.toLowerCase()] ?? whole
      const n =
        code[1] === 'x' || code[1] === 'X'
          ? Number.parseInt(code.slice(2), 16)
          : Number(code.slice(1))
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole
    })
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

/** The readable text of a Lexical document (or a legacy plain string), blocks separated by newlines. */
export function richTextToText(body: unknown): string {
  if (body == null) return ''
  if (typeof body === 'string') {
    const trimmed = body.trim()
    if (!trimmed.startsWith('{')) return /<[a-z!/]/i.test(trimmed) ? htmlToText(trimmed) : trimmed
    try {
      return richTextToText(JSON.parse(trimmed))
    } catch {
      return trimmed
    }
  }
  const root = (body as { root?: LexicalNode }).root
  if (!root) return ''
  const blocks: string[] = []
  const walk = (node: LexicalNode, into: string[]): void => {
    if (typeof node.text === 'string') into.push(node.text)
    for (const child of node.children ?? []) {
      if (child.type && BLOCK_TYPES.has(child.type)) {
        const inner: string[] = []
        walk(child, inner)
        const line = inner.join('').trim()
        if (line) blocks.push(line)
      } else {
        walk(child, into)
      }
    }
  }
  const loose: string[] = []
  walk(root, loose)
  const tail = loose.join('').trim()
  if (tail) blocks.push(tail)
  return blocks.join('\n')
}

/** An HTML tag, as in `<h2>` or `</p>`: not a lone `<` in prose ("a < b"). */
const HTML_TAG = /<\/?[a-z][a-z0-9]*\b[^>]*>/i

/**
 * The words of an excerpt or body on one line. HTML is read as HTML, even typed into the editor
 * as text (a merchant pasting an article's source): a card never shows its tags.
 */
function plainLine(value: unknown): string {
  const text = richTextToText(value)
  return (HTML_TAG.test(text) ? htmlToText(text) : text).replace(/\s+/g, ' ').trim()
}

/** The merchant's excerpt as plain text on one line; empty when there is none. */
export function excerptText(excerpt: string | null | undefined): string {
  // A Shopify import can carry HTML in the excerpt too; the card shows words.
  return excerpt ? plainLine(excerpt) : ''
}

/** The merchant's excerpt, or the opening of the body cut at a word boundary. */
export function articleExcerpt(
  excerpt: string | null | undefined,
  body: unknown,
  max = 160,
): string {
  const own = excerptText(excerpt)
  if (own) return own
  const text = plainLine(body)
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:]+$/, '')}…`
}

/** Minutes to read at ~200 words a minute, never less than one. */
export function readingMinutes(body: unknown): number {
  const words = richTextToText(body).split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

/** Trimmed, de-duplicated (case-insensitive, first spelling wins), in the order given. */
export function normaliseTags(tags: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const tag = raw.trim().replace(/\s+/g, ' ')
    const key = tag.toLowerCase()
    if (!tag || seen.has(key)) continue
    seen.add(key)
    out.push(tag)
  }
  return out
}

/** Whether a shopper can see the article right now. */
export function isArticleVisible(
  status: ArticleStatus,
  publishedAt: Date | string | null,
  now: Date = new Date(),
): boolean {
  if (status === 'draft' || publishedAt == null) return false
  return new Date(publishedAt).getTime() <= now.getTime()
}

/** What the admin shows: a scheduled article whose time has come reads as published. */
export function displayStatus(
  status: ArticleStatus,
  publishedAt: Date | string | null,
  now: Date = new Date(),
): ArticleStatus {
  if (status === 'scheduled' && isArticleVisible(status, publishedAt, now)) return 'published'
  return status
}

/** "23 Sept 2026" in the store's time zone; an unknown zone falls back to UTC. */
export function formatArticleDate(value: Date | string | number, timeZone: string): string {
  const date = new Date(value)
  try {
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
  }
}

/** A visible post row mapped to the card shape the storefront blocks render. */
export function toCardArticle(row: {
  id: string
  title: string
  handle: string
  author: string
  excerpt: string | null
  body: unknown
  publishedAt: Date | string | null
  imageUrl: string | null
  imageAlt: string | null
  blogHandle: string
  blogTitle: string
  timeZone: string
}) {
  return {
    id: row.id,
    href: `/blogs/${row.blogHandle}/${row.handle}`,
    title: row.title,
    excerpt: articleExcerpt(row.excerpt, row.body),
    author: row.author,
    publishedAt: new Date(row.publishedAt ?? 0).toISOString(),
    dateLabel: formatArticleDate(row.publishedAt ?? 0, row.timeZone),
    imageUrl: row.imageUrl,
    imageAlt: row.imageAlt,
    blogTitle: row.blogTitle,
  }
}
