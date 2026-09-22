import type { CardArticle } from '../types'
import ArticleCard from './article-card'
import SectionHeading from './section-heading'

type BlogPostsProps = {
  heading: string
  layout: 'grid' | 'list'
  articles: CardArticle[]
  viewAll?: { href: string; label: string } | undefined
}

/** The "Blog posts" section: latest posts from one blog, or from every blog. */
export default function BlogPosts({ heading, layout, articles, viewAll }: BlogPostsProps) {
  // Early returns
  if (articles.length === 0) return null

  // Render logic
  return (
    <div className="page-width">
      {heading ? <SectionHeading heading={heading} {...(viewAll ? { viewAll } : {})} /> : null}
      <div className="blog-posts__items" data-layout={layout}>
        {articles.map((a) => (
          <ArticleCard key={a.id} article={a} layout={layout} />
        ))}
      </div>
    </div>
  )
}
