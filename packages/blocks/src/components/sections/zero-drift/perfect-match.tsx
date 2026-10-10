// Port of sections/perfect-match.liquid (+ the assets it uses): a headline with product cutouts orbiting it
import { linkTarget } from '../../../link'
import type { Link } from '../../../sections/framed'
import { safeHref } from '../../../slot-types'
import type { CardProduct } from '../../../types'
import Picture from '../../picture'
import Reveal from '../../reveal'
import PerfectMatchRing from './perfect-match-ring'
import PerfectMatchWord from './perfect-match-word'

type PerfectMatchProps = {
  eyebrow: string
  headingBefore: string
  highlight: string
  headingAfter: string
  /** Words the highlight cycles through after the first, separated by `|`. */
  highlightWords: string
  cta: Link
  products: CardProduct[]
}

const parseWords = (list: string): string[] =>
  (list ?? '')
    .split('|')
    .map((w) => w.trim())
    .filter(Boolean)

export default function PerfectMatch({
  eyebrow,
  headingBefore,
  highlight,
  headingAfter,
  highlightWords,
  cta,
  products,
}: PerfectMatchProps) {
  // Render logic
  const ring = products.filter((p) => p.images[0]?.url)
  const ctaHref = safeHref(cta.href)
  const hasHeading = Boolean(headingBefore || highlight || headingAfter)
  const stageStyle =
    ring.length > 0 ? ({ '--total': ring.length } as React.CSSProperties) : undefined

  return (
    <div className="section-perfect-match page-width">
      <div className="perfect-match__stage" style={stageStyle}>
        {ring.length > 0 ? (
          <PerfectMatchRing>
            {ring.map((p, i) => {
              const image = p.images[0]
              if (!image) return null
              return (
                <a
                  key={p.id}
                  href={`/products/${p.handle}`}
                  className="perfect-match__slot"
                  style={{ '--i': i + 1 } as React.CSSProperties}
                >
                  <span className="perfect-match__slot-media">
                    <Picture
                      image={image}
                      alt={image.alt || p.title}
                      fill
                      loading="eager"
                      fetchPriority="low"
                      sizes="(min-width: 990px) 18vw, 40vw"
                    />
                  </span>
                </a>
              )
            })}
          </PerfectMatchRing>
        ) : null}

        <div className="perfect-match__center">
          {hasHeading ? (
            <Reveal>
              {eyebrow ? <p className="perfect-match__eyebrow">{eyebrow}</p> : null}
              <h2 className="perfect-match__heading h1">
                {headingBefore ? <>{headingBefore} </> : null}
                {highlight ? (
                  <span className="perfect-match__highlight">
                    <PerfectMatchWord words={parseWords(highlightWords)}>
                      {highlight}
                    </PerfectMatchWord>
                  </span>
                ) : null}
                {headingAfter ? <> {headingAfter}</> : null}
              </h2>
            </Reveal>
          ) : null}
          {cta.label && ctaHref ? (
            <a href={ctaHref} className="btn btn--primary perfect-match__cta" {...linkTarget(cta)}>
              {cta.label}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}
