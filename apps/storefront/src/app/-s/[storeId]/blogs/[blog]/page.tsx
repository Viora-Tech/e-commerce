import { ArticleCard } from '@commerce/blocks'
import { getBlogByHandle, listVisibleArticles, toCardArticle } from '@commerce/core'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import BlogPagination from '@/components/blog/blog-pagination'
import TagFilter from '@/components/blog/tag-filter'
import { BLOG_PER_PAGE, blogContent as copy } from '@/data/blog'
import { breadcrumbList, jsonLd, requestOrigin } from '@/lib/seo'
import { inStore } from '@/lib/store-context'
import { renderTemplate } from '@/lib/template-render'

type Params = {
  params: Promise<{ storeId: string; blog: string }>
  /** `view` is the Customize preview's alternate template. */
  searchParams: Promise<{ tag?: string; page?: string; view?: string }>
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { storeId, blog: handle } = await params
  const found = await inStore(storeId, (tx) => getBlogByHandle(tx, handle))
  if (!found) return {}
  const title = found.seoTitle ?? found.title
  const description = found.seoDescription ?? undefined
  return {
    title,
    description,
    alternates: { canonical: `/blogs/${found.handle}` },
    openGraph: { type: 'website', title, description },
  }
}

export default async function BlogPage({ params, searchParams }: Params) {
  const { storeId, blog: handle } = await params
  const query = await searchParams
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1)
  const tag = query.tag?.trim() || undefined

  const data = await inStore(storeId, async (tx) => {
    const found = await getBlogByHandle(tx, handle)
    if (!found) return null
    const posts = await listVisibleArticles(tx, found.id, { tag, page, perPage: BLOG_PER_PAGE })
    return { blog: found, posts }
  })
  if (!data) notFound()

  const { blog, posts } = data
  const origin = await requestOrigin()
  const cards = posts.rows.map(toCardArticle)
  const pages = Math.max(1, Math.ceil(posts.total / BLOG_PER_PAGE))
  const path = `/blogs/${blog.handle}`
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Blog',
        name: blog.title,
        url: `${origin}${path}`,
        description: blog.seoDescription ?? undefined,
        blogPost: cards.map((c) => ({
          '@type': 'BlogPosting',
          headline: c.title,
          url: `${origin}${c.href}`,
          datePublished: c.publishedAt,
          image: c.imageUrl ?? undefined,
          author: c.author ? { '@type': 'Person', name: c.author } : undefined,
        })),
      },
      breadcrumbList(origin, [
        { name: copy.home, path: '/' },
        { name: blog.title, path },
      ]),
    ],
  }

  const main = (
    <section className="page-width flex flex-col gap-8 py-12">
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from our own data, `<` escaped. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(schema)} />
      <nav aria-label="Breadcrumb" className="text-caption text-muted">
        <Link href="/" className="hover:text-ink">
          {copy.home}
        </Link>
        <span aria-hidden> / </span>
        <span className="text-ink">{blog.title}</span>
      </nav>
      <header className="flex flex-col gap-4">
        <h1 className="text-ink">{blog.title}</h1>
        {posts.tags.length > 0 ? <TagFilter path={path} tags={posts.tags} active={tag} /> : null}
      </header>

      {cards.length > 0 ? (
        <div className="blog-posts__items" data-layout="grid">
          {cards.map((card, i) => (
            <ArticleCard key={card.id} article={card} lazy={i > 2} />
          ))}
        </div>
      ) : (
        <p className="text-muted">{tag ? copy.emptyTag(tag) : copy.empty}</p>
      )}

      <BlogPagination path={path} tag={tag} page={page} pages={pages} />
    </section>
  )
  return renderTemplate(storeId, 'blog', {
    suffix: blog.templateSuffix,
    view: query.view,
    renderers: { MainBlog: () => main },
  })
}
