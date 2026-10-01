// Port of sections/reviews-showcase.liquid (+ the assets it uses): the moving wall of review cards
import { reviewsShowcaseContent as copy } from '../../../data/glide/reviews-showcase'
import ReviewCard, { type ShowcaseReview } from './reviews-showcase-card'

type ReviewsWallProps = {
  reviews: ShowcaseReview[]
  showProduct: boolean
  /** `columns` is the tilted 3D plane on desktop, `rows` the two flat rows for phones. */
  layout: 'columns' | 'rows'
}

type GroupProps = {
  reviews: ShowcaseReview[]
  firstIndex: number
  showProduct: boolean
  /** The looping copy: inert and hidden from screen readers. */
  copyOnly: boolean
  className: string
}

type Column = { reverse: boolean; slow: boolean; fromB: boolean }

const COLUMNS: Column[] = [
  { reverse: false, slow: false, fromB: false },
  { reverse: true, slow: false, fromB: true },
  { reverse: false, slow: true, fromB: false },
  { reverse: true, slow: true, fromB: true },
]

function Group({ reviews, firstIndex, showProduct, copyOnly, className }: GroupProps) {
  return (
    <div className={className} aria-hidden={copyOnly || undefined} inert={copyOnly || undefined}>
      {reviews.map((review, i) => (
        <ReviewCard
          // biome-ignore lint/suspicious/noArrayIndexKey: wall cards carry no id and never reorder between renders.
          key={`${review.name}-${i}`}
          review={review}
          index={firstIndex + i * 2}
          showProduct={showProduct}
        />
      ))}
    </div>
  )
}

type RowProps = {
  reviews: ShowcaseReview[]
  firstIndex: number
  showProduct: boolean
  reverse: boolean
}

function Row({ reviews, firstIndex, showProduct, reverse }: RowProps) {
  return (
    <div className={`reviews-showcase__row${reverse ? ' reviews-showcase__row--reverse' : ''}`}>
      <div className="reviews-showcase__track">
        <Group
          reviews={reviews}
          firstIndex={firstIndex}
          showProduct={showProduct}
          copyOnly={false}
          className="reviews-showcase__group"
        />
        <Group
          reviews={reviews}
          firstIndex={firstIndex}
          showProduct={showProduct}
          copyOnly
          className="reviews-showcase__group"
        />
      </div>
    </div>
  )
}

// Odd cards ride one lane, even cards the other. Each track prints its cards twice and slides
// by half its length, so the loop has no seam; the copy is inert and hidden from readers.
export default function ReviewsWall({ reviews, showProduct, layout }: ReviewsWallProps) {
  // Render logic
  const laneA = reviews.filter((_, i) => i % 2 === 0)
  const laneB = reviews.filter((_, i) => i % 2 === 1)
  const hasB = laneB.length > 0

  // Early returns
  if (reviews.length === 0) return null

  if (layout === 'rows') {
    return (
      <>
        <Row reviews={laneA} firstIndex={0} showProduct={showProduct} reverse={false} />
        {hasB ? <Row reviews={laneB} firstIndex={1} showProduct={showProduct} reverse /> : null}
      </>
    )
  }

  return (
    <section className="rs-3d" aria-label={copy.groupLabel}>
      <div className="rs-3d__plane">
        {COLUMNS.map((col, c) => {
          const useB = col.fromB && hasB
          const lane = useB ? laneB : laneA
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: the four columns are fixed.
              key={c}
              className={`rs-3d__col${col.reverse ? ' rs-3d__col--reverse' : ''}${col.slow ? ' rs-3d__col--slow' : ''}`}
            >
              <div className="rs-3d__track">
                <Group
                  reviews={lane}
                  firstIndex={useB ? 1 : 0}
                  showProduct={showProduct}
                  copyOnly={c !== 0}
                  className="rs-3d__group"
                />
                <Group
                  reviews={lane}
                  firstIndex={useB ? 1 : 0}
                  showProduct={showProduct}
                  copyOnly
                  className="rs-3d__group"
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
