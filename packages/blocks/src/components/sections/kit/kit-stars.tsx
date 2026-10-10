import Icon from '../../icon'

type KitStarsProps = { rating: number; label: string }

/** Up to five stars in the brand colour; the empty ones stay quiet. Read out as one label. */
export default function KitStars({ rating, label }: KitStarsProps) {
  // Early returns
  const filled = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)))
  if (filled === 0) return null

  // Render logic
  return (
    <span role="img" aria-label={label} className="flex gap-[0.125rem]">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={n <= filled ? 'text-[var(--color-brand)]' : 'text-[var(--color-line)]'}
        >
          <Icon name="star" size={14} />
        </span>
      ))}
    </span>
  )
}
