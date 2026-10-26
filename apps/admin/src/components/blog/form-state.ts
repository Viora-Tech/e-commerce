import type { ArticleStatus, ArticleWrite } from '@commerce/core/blog'
import { DEFAULT_TIME_ZONE, wallClock, zoneOffsetMs } from '@commerce/dates'
import type { RichTextValue } from '@commerce/richtext'
import type { api } from '@/lib/api-client'

/** What `blog.get` returns. */
export type LoadedArticle = Awaited<ReturnType<typeof api.blog.get>>
export type BlogOption = { id: string; title: string; handle: string }

export type ArticleFormState = {
  blogId: string
  title: string
  handle: string
  body: RichTextValue | null
  excerpt: string
  author: string
  imageMediaId: string | null
  imageUrl: string | null
  imageAlt: string
  tags: string[]
  status: ArticleStatus
  /** `datetime-local` value, the store's wall time (Asia/Kolkata). */
  publishedAt: string
  seoTitle: string
  seoDescription: string
  /** Alternate `article.<suffix>` template; blank is the default. */
  templateSuffix: string
}

/**
 * `datetime-local` wants wall time without the zone. It is the store's wall time
 * (Asia/Kolkata), never the runtime's: the page is first rendered on the server (UTC), and a
 * runtime-zone value shifted the publish time by 5:30 between server and browser.
 */
export function toLocalInput(d: Date | string | null): string {
  if (!d) return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  // wallClock's UTC fields read the store zone's clock: "YYYY-MM-DDTHH:mm".
  return wallClock(date, DEFAULT_TIME_ZONE).toISOString().slice(0, 16)
}

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/

/** The instant a `datetime-local` value means in the store's zone; null when blank or invalid. */
export function fromLocalInput(s: string): Date | null {
  const m = LOCAL_INPUT.exec(s)
  if (!m) return null
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number]
  const asUtc = new Date(Date.UTC(y, mo - 1, d, h, mi))
  if (Number.isNaN(asUtc.getTime())) return null
  return new Date(asUtc.getTime() - zoneOffsetMs(asUtc, DEFAULT_TIME_ZONE))
}

export function emptyArticleForm(blogId: string, author: string): ArticleFormState {
  return {
    blogId,
    title: '',
    handle: '',
    body: null,
    excerpt: '',
    author,
    imageMediaId: null,
    imageUrl: null,
    imageAlt: '',
    tags: [],
    status: 'draft',
    publishedAt: '',
    seoTitle: '',
    seoDescription: '',
    templateSuffix: '',
  }
}

export function fromArticle(a: LoadedArticle): ArticleFormState {
  return {
    blogId: a.blogId,
    title: a.title,
    handle: a.handle,
    body: (a.body ?? null) as RichTextValue | null,
    excerpt: a.excerpt ?? '',
    author: a.author,
    imageMediaId: a.imageMediaId,
    imageUrl: a.imageUrl,
    imageAlt: a.imageAlt ?? '',
    tags: a.tags,
    status: a.status,
    publishedAt: toLocalInput(a.publishedAt),
    seoTitle: a.seoTitle ?? '',
    seoDescription: a.seoDescription ?? '',
    templateSuffix: a.templateSuffix ?? '',
  }
}

export function toWrite(form: ArticleFormState): ArticleWrite {
  return {
    blogId: form.blogId,
    title: form.title.trim(),
    ...(form.handle.trim() ? { handle: form.handle.trim() } : {}),
    author: form.author.trim(),
    body: form.body as ArticleWrite['body'],
    excerpt: form.excerpt.trim() || null,
    imageMediaId: form.imageMediaId,
    imageAlt: form.imageAlt.trim() || null,
    tags: form.tags,
    status: form.status,
    publishedAt: fromLocalInput(form.publishedAt),
    seoTitle: form.seoTitle.trim() || null,
    seoDescription: form.seoDescription.trim() || null,
    templateSuffix: form.templateSuffix || null,
  }
}
