import type { ReactNode } from 'react'
import { dropsTeaserContent as copy } from '../../../data/zero-drift/drops-teaser'
import { safeHref } from '../../../slot-types'
import RichCopy from '../../rich-copy'

export type DropView = {
  period: ReactNode
  title: ReactNode
  text: ReactNode
  status: string
  link: string
  linkLabel: ReactNode
}

type DropsTeaserProps = {
  eyebrow: ReactNode
  heading: ReactNode
  roadmapLink: string
  roadmapLabel: ReactNode
  drops: DropView[]
}

function statusLabel(status: string): string {
  return copy.statuses[status as keyof typeof copy.statuses] ?? copy.statuses.coming
}

function statusTone(status: string): string {
  return copy.tones[status as keyof typeof copy.tones] ?? copy.tones.coming
}

// Port of sections/drops-teaser.liquid (+ snippets/drop-card.liquid): the next few arrivals as cards with a status pill.
export default function DropsTeaser({
  eyebrow,
  heading,
  roadmapLink,
  roadmapLabel,
  drops,
}: DropsTeaserProps) {
  // Render logic
  const roadmapHref = safeHref(roadmapLink)

  return (
    <div className="section-drops-teaser">
      <div className="drops-teaser__head">
        <div>
          {eyebrow ? <p className="eyebrow drops-teaser__eyebrow">{eyebrow}</p> : null}
          {heading ? <h2 className="drops-teaser__heading h2">{heading}</h2> : null}
        </div>
        {roadmapHref && roadmapLabel ? (
          <a className="btn btn--secondary" href={roadmapHref}>
            {roadmapLabel}
          </a>
        ) : null}
      </div>
      {drops.length === 0 ? (
        <p className="drops-teaser__empty">{copy.empty}</p>
      ) : (
        <ol className="drops-teaser__list">
          {drops.map((drop, i) => {
            const href = safeHref(drop.link)
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: drops have no id and are reordered only in the editor.
              <li key={i} className={`drop-card drop-card--${drop.status}`}>
                <p className="drop-card__period text-caption">{drop.period}</p>
                <h3 className="drop-card__title h4">{drop.title}</h3>
                <RichCopy value={drop.text} className="drop-card__text text-small" />
                <div className="drop-card__foot">
                  <span
                    className={`drop-card__status drop-card__status--${statusTone(drop.status)}`}
                  >
                    <span className="drop-card__status-dot" aria-hidden="true" />
                    {statusLabel(drop.status)}
                  </span>
                  {href ? (
                    <a className="drop-card__link text-small" href={href}>
                      {drop.linkLabel ? drop.linkLabel : copy.linkLabelFallback} &rarr;
                    </a>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
