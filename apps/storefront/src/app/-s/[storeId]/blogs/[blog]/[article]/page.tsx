import { Icon } from '@commerce/blocks'
import {
  articleExcerpt,
  formatArticleDate,
  getBlogByHandle,
  getVisibleArticle,
  readingMinutes,
} from '@commerce/core'
import { parseRichText, RichTextRenderer } from '@commerce/richtext'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ArticleNeighbours from '@/components/blog/article-neighbours'
import ShareLinks from '@/components/blog/share-links'
import { blogContent as copy } from '@/data/blog'
import { breadcrumbList, jsonLd, requestOrigin } from '@/lib/seo'
import { inStore } from '@/lib/store-context'
import { renderTemplate } from '@/lib/template-render'

type Params = {
  params: Promise<{ storeId: string; blog: string; article: string }>
  /** `?view=` from the Customize preview: the alternate template being edited. */
  searchParams?: Promise<{ view?: string }>
}

async function load(storeId: string, blogHandle: string, handle: string) {
  return inStore(storeId, async (tx) => {
    const blog = await getBlogByHandle(tx, blogHandle)
    if (!blog) return null
    const post = await getVisibleArticle(tx, blog.id, handle)
    return post ? { blog, post } : null
  })
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { storeId, blog, article } = await params
  const found = await load(storeId, blog, article)
  if (!found) return {}
  const { post } = found
  const title = post.seoTitle ?? post.title
  const description = post.seoDescription ?? articleExcerpt(post.excerpt, post.body)
  return {
    title,
    description,
    alternates: { canonical: `/blogs/${blog}/${post.handle}` },
    openGraph: {
      type: 'article',
      title,
      description,
      publishedTime: post.publishedAt?.toISOString(),
      authors: post.author ? [post.author] : undefined,
      tags: post.tags,
      images: post.imageUrl
        ? [{ url: post.imageUrl, alt: post.imageAlt ?? post.title }]
        : undefined,
    },
    twitter: { card: post.imageUrl ? 'summary_large_image' : 'summary', title, description },
  }
}

export default async function ArticlePage({ params, searchParams }: Params) {
  const { storeId, blog: blogHandle, article: handle } = await params
  const view = (await searchParams)?.view
  const found = await load(storeId, blogHandle, handle)
  if (!found) notFound()

  const { blog, post } = found
  const origin = await requestOrigin()
  const blogPath = `/blogs/${blog.handle}`
  const url = `${origin}${blogPath}/${post.handle}`
  const published = post.publishedAt ?? new Date()
  const description = articleExcerpt(post.excerpt, post.body)
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        headline: post.title,
        description,
        url,
        mainEntityOfPage: url,
        datePublished: published.toISOString(),
        dateModified: post.updatedAt.toISOString(),
        image: post.imageUrl ?? undefined,
        author: post.author ? { '@type': 'Person', name: post.author } : undefined,
        keywords: post.tags.length ? post.tags.join(', ') : undefined,
        isPartOf: { '@type': 'Blog', name: blog.title, url: `${origin}${blogPath}` },
      },
      breadcrumbList(origin, [
        { name: copy.home, path: '/' },
        { name: blog.title, path: blogPath },
        { name: post.title, path: `${blogPath}/${post.handle}` },
      ]),
    ],
  }

  const main = (
    <div className="page-width">
      <article className="article-page">
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from our own data, `<` escaped. */}
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(schema)} />
        <Link href={blogPath} className="article-page__back">
          <Icon name="arrow-right" size={14} />
          {copy.backTo(blog.title)}
        </Link>

        <header className="article-page__header">
          <p className="article-page__meta">
            {post.tags[0] ? <span className="article-page__tag">{post.tags[0]}</span> : null}
            <time dateTime={published.toISOString()}>
              {formatArticleDate(published, post.timeZone)}
            </time>
            <span aria-hidden="true">·</span>
            <span>{copy.readingTime(readingMinutes(post.body))}</span>
          </p>
          <h1 className="section-title">{post.title}</h1>
          {post.author ? <p className="article-page__byline">{copy.by(post.author)}</p> : null}
        </header>

        {post.imageUrl ? (
          // biome-ignore lint/performance/noImgElement: media library URLs, no optimisation pipeline on the storefront yet.
          <img src={post.imageUrl} alt={post.imageAlt ?? ''} className="article-page__image" />
        ) : null}

        {post.body ? (
          <RichTextRenderer data={parseRichText(post.body)} className="rte text-ink" />
        ) : null}

        {post.tags.length > 0 ? (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">{copy.tagged}</span>
            {post.tags.map((tag) => (
              <Link
                key={tag}
                href={`${blogPath}?tag=${encodeURIComponent(tag)}`}
                className="rounded-full border border-line px-3 py-1 text-ink hover:border-ink"
              >
                {tag}
              </Link>
            ))}
          </p>
        ) : null}

        <ShareLinks url={url} title={post.title} />
        <ArticleNeighbours blogPath={blogPath} previous={post.previous} next={post.next} />
      </article>
    </div>
  )
  return renderTemplate(storeId, 'article', {
    suffix: post.templateSuffix,
    view,
    renderers: { MainArticle: () => main },
  })
}
