import type { ReactNode } from 'react'
import { notesSeriesContent as copy } from '../../../data/zero-drift/notes-series'
import { safeHref } from '../../../slot-types'
import type { CardArticle } from '../../../types'
import RichCopy from '../../rich-copy'

type NotesSeriesProps = {
  eyebrow: ReactNode
  heading: ReactNode
  text: ReactNode
  seriesLabel: string
  blogHandle: string
  showViewAll: boolean
  articles: CardArticle[]
}

function truncate(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > copy.excerptLength
    ? `${flat.slice(0, copy.excerptLength - 1).trimEnd()}${copy.ellipsis}`
    : flat
}

// Port of sections/notes-series.liquid: a study-note series as a shelf of cards, in reading order.
export default function NotesSeries({
  eyebrow,
  heading,
  text,
  seriesLabel,
  blogHandle,
  showViewAll,
  articles,
}: NotesSeriesProps) {
  // Early returns
  if (articles.length === 0) return <p className="notes-series__empty">{copy.empty}</p>

  // Render logic
  const allHref = blogHandle ? safeHref(`/blogs/${blogHandle}`) : null

  return (
    <div className="section-notes-series">
      <div className="notes-series__head">
        <div>
          {eyebrow ? <p className="eyebrow notes-series__eyebrow">{eyebrow}</p> : null}
          {heading ? <h2 className="notes-series__heading h2">{heading}</h2> : null}
          <RichCopy value={text} className="notes-series__text text-body" />
        </div>
        {showViewAll && allHref ? (
          <a className="notes-series__all btn btn--secondary" href={allHref}>
            {copy.viewAll}
          </a>
        ) : null}
      </div>
      <ol className="notes-series__shelf">
        {articles.map((a, i) => (
          <li key={a.id} className="notes-series__item">
            <a className="note-card" href={a.href}>
              <span className="note-card__series text-caption">
                {seriesLabel || a.blogTitle} - {String(i + 1).padStart(2, '0')}
              </span>
              <span className="note-card__title">{a.title}</span>
              {a.excerpt ? <span className="note-card__excerpt">{truncate(a.excerpt)}</span> : null}
              <span className="note-card__read text-small">{copy.read} &rarr;</span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  )
}
