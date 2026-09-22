import type { ArticleStatus, ArticleWrite } from '@commerce/core/blog'
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
  /** `datetime-local` value, local wall time. */
  publishedAt: string
  seoTitle: string
  seoDescription: string
}

/** `datetime-local` wants local wall time without the zone. */
export function toLocalInput(d: Date | string | null): string {
  if (!d) return ''
  const date = new Date(d)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
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
    publishedAt: form.publishedAt ? new Date(form.publishedAt) : null,
    seoTitle: form.seoTitle.trim() || null,
    seoDescription: form.seoDescription.trim() || null,
  }
}
