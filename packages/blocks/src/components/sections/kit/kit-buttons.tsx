import { linkTarget } from '../../../link'
import type { Link } from '../../../sections/framed'
import { cx, safeHref } from '../../../slot-types'

type KitButtonsProps = {
  primary?: Link | undefined
  secondary?: Link | undefined
  /** Centre the row (centred heroes and cards); start-aligned otherwise. */
  center?: boolean | undefined
  className?: string | undefined
}

/** The primary and secondary buttons every kit section ends with; a blank label hides one. */
export default function KitButtons({ primary, secondary, center, className }: KitButtonsProps) {
  // Early returns
  if (!primary?.label && !secondary?.label) return null

  // Render logic
  return (
    <div
      className={cx(
        'flex flex-wrap items-center gap-[0.75rem]',
        center && 'justify-center',
        className,
      )}
    >
      {primary?.label ? (
        <a
          className="btn btn--primary"
          href={safeHref(primary.href) ?? '#'}
          {...linkTarget(primary)}
        >
          {primary.label}
        </a>
      ) : null}
      {secondary?.label ? (
        <a
          className="btn btn--secondary"
          href={safeHref(secondary.href) ?? '#'}
          {...linkTarget(secondary)}
        >
          {secondary.label}
        </a>
      ) : null}
    </div>
  )
}
