import type { CardArticle } from '../types'

type ArticleCardProps = {
  article: CardArticle
  /** `list` lays the image beside the text instead of above it. */
  layout?: 'grid' | 'list'
  lazy?: boolean
}

const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' })

/** A blog post card: featured image, date, title and excerpt. */
export default function ArticleCard({ article, layout = 'grid', lazy = true }: ArticleCardProps) {
  // Render logic
  return (
    <article className="article-card" data-layout={layout}>
      <a href={article.href} className="article-card__link">
        <div className="article-card__media">
          {article.imageUrl ? (
            <img
              src={article.imageUrl}
              alt={article.imageAlt ?? ''}
              loading={lazy ? 'lazy' : 'eager'}
              className="article-card__image"
            />
          ) : null}
        </div>
        <div className="article-card__body">
          <p className="article-card__meta text-caption">
            <time dateTime={article.publishedAt}>
              {dateFormat.format(new Date(article.publishedAt))}
            </time>
            {article.author ? <span> · {article.author}</span> : null}
          </p>
          <h3 className="article-card__title">{article.title}</h3>
          {article.excerpt ? <p className="article-card__excerpt">{article.excerpt}</p> : null}
        </div>
      </a>
    </article>
  )
}
