import { focalStyle } from '../../../focal-point'
import type { Image } from '../../../sections/framed'
import { cx } from '../../../slot-types'
import Picture from '../../picture'

type KitMediaProps = {
  image: Image
  /** Aspect and radius classes for the frame, e.g. `aspect-[4/5] rounded-[var(--radius-card)]`. */
  className: string
  sizes: string
  /** The storefront's first section: this image is likely the LCP. */
  eager?: boolean | undefined
}

const PLACEHOLDER =
  'linear-gradient(135deg,color-mix(in oklab,var(--color-brand) 22%,var(--color-surface)),color-mix(in oklab,var(--color-accent) 18%,var(--color-surface)))'

/** A kit section's picture, or a soft brand-tinted panel until the merchant picks one. */
export default function KitMedia({ image, className, sizes, eager }: KitMediaProps) {
  // Early returns
  if (!image?.url) {
    return (
      <div
        aria-hidden
        className={cx('w-full', className)}
        style={{ backgroundImage: PLACEHOLDER }}
      />
    )
  }

  // Render logic
  return (
    <div className={cx('relative w-full overflow-hidden', className)}>
      <Picture
        image={image}
        alt={image.alt}
        className="absolute inset-0 size-full object-cover"
        style={focalStyle(image.focal)}
        fill
        sizes={sizes}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : undefined}
      />
    </div>
  )
}
