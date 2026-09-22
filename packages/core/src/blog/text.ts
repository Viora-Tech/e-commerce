import type { ArticleStatus } from './schemas'

/**
 * Pure blog helpers shared by the admin editor, the storefront and the service.
 * No database, no React: safe in client components via `@commerce/core/blog`.
 */

type LexicalNode = { type?: string; text?: string; children?: LexicalNode[] }

const BLOCK_TYPES = new Set(['paragraph', 'heading', 'quote', 'listitem', 'code'])

/** The readable text of a Lexical document (or a legacy plain string), blocks separated by newlines. */
export function richTextToText(body: unknown): string {
  if (body == null) return ''
  if (typeof body === 'string') {
    const trimmed = body.trim()
    if (!trimmed.startsWith('{')) return trimmed
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

/** The merchant's excerpt, or the opening of the body cut at a word boundary. */
export function articleExcerpt(
  excerpt: string | null | undefined,
  body: unknown,
  max = 160,
): string {
  const own = excerpt?.trim()
  if (own) return own
  const text = richTextToText(body).replace(/\s+/g, ' ').trim()
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
}) {
  return {
    id: row.id,
    href: `/blogs/${row.blogHandle}/${row.handle}`,
    title: row.title,
    excerpt: articleExcerpt(row.excerpt, row.body),
    author: row.author,
    publishedAt: new Date(row.publishedAt ?? 0).toISOString(),
    imageUrl: row.imageUrl,
    imageAlt: row.imageAlt,
    blogTitle: row.blogTitle,
  }
}
