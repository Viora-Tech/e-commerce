// Port of sections/reviews-showcase.liquid: the moving wall of review cards. The motion is the
// UI kit's, not the theme's CSS: Magic UI's 3D Marquee on desktop (`effects/marquee-3d.tsx`)
// and two Magic UI Marquee rows on phones (`effects/marquee.tsx`).
import { reviewsShowcaseContent as copy } from '../../../data/zero-drift/reviews-showcase'
import Marquee from '../../../effects/marquee'
import Marquee3d from '../../../effects/marquee-3d'
import ReviewCard, { type ShowcaseReview } from './reviews-showcase-card'

type ReviewsWallProps = {
  reviews: ShowcaseReview[]
  showProduct: boolean
  /** `columns` is the tilted 3D plane on desktop, `rows` the two flat rows for phones. */
  layout: 'columns' | 'rows'
  /** Seconds one pass of a lane takes. */
  speedSeconds: number
}

type LaneProps = {
  reviews: ShowcaseReview[]
  firstIndex: number
  showProduct: boolean
}

/** Columns 2 to 4 repeat the two lanes; only the first is read out. */
const COLUMN_LANES = ['a', 'b', 'a', 'b'] as const
/** Under reduced motion a row holds still and scrolls sideways instead, card by card. */
const ROW_CLASS = 'motion-reduce:snap-x motion-reduce:snap-mandatory motion-reduce:overflow-x-auto'
/** The second phone row runs a little slower, as in the theme. */
const SECOND_ROW_FACTOR = 1.15

function Lane({ reviews, firstIndex, showProduct }: LaneProps) {
  return (
    <>
      {reviews.map((review, i) => (
        <ReviewCard
          // biome-ignore lint/suspicious/noArrayIndexKey: wall cards carry no id and never reorder between renders.
          key={`${review.name}-${i}`}
          review={review}
          index={firstIndex + i * 2}
          showProduct={showProduct}
        />
      ))}
    </>
  )
}

// Odd cards ride one lane, even cards the other.
export default function ReviewsWall({
  reviews,
  showProduct,
  layout,
  speedSeconds,
}: ReviewsWallProps) {
  // Render logic
  const laneA = reviews.filter((_, i) => i % 2 === 0)
  const laneB = reviews.filter((_, i) => i % 2 === 1)
  const hasB = laneB.length > 0

  // Early returns
  if (reviews.length === 0) return null

  if (layout === 'rows') {
    return (
      <div className="reviews-showcase__rows">
        <Marquee
          pauseOnHover
          durationSeconds={speedSeconds}
          className={ROW_CLASS}
          groupClassName="items-stretch"
        >
          <Lane reviews={laneA} firstIndex={0} showProduct={showProduct} />
        </Marquee>
        {hasB ? (
          <Marquee
            reverse
            pauseOnHover
            durationSeconds={speedSeconds * SECOND_ROW_FACTOR}
            className={ROW_CLASS}
            groupClassName="items-stretch"
          >
            <Lane reviews={laneB} firstIndex={1} showProduct={showProduct} />
          </Marquee>
        ) : null}
      </div>
    )
  }

  const columns = COLUMN_LANES.map((lane, c) => {
    // Keys are the fixed column positions (the four columns never reorder).
    const key = `column-${c}`
    const useB = lane === 'b' && hasB
    const lane3d = useB ? laneB : laneA
    const firstIndex = useB ? 1 : 0
    return c === 0 ? (
      <Lane key={key} reviews={lane3d} firstIndex={firstIndex} showProduct={showProduct} />
    ) : (
      <div key={key} className="contents" aria-hidden="true" inert>
        <Lane reviews={lane3d} firstIndex={firstIndex} showProduct={showProduct} />
      </div>
    )
  })

  return (
    <Marquee3d
      columns={columns}
      durationSeconds={speedSeconds}
      label={copy.groupLabel}
      className="rs-3d"
    />
  )
}
