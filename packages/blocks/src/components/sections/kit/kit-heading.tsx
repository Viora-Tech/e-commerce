import type { ReactNode } from 'react'
import { cx } from '../../../slot-types'
import RichCopy from '../../rich-copy'

type KitHeadingProps = {
  heading: ReactNode
  text?: ReactNode
  /** Centred above a grid (most kit sections); start-aligned beside other content. */
  center?: boolean | undefined
  className?: string | undefined
}

/** A kit section's heading and short intro, the same size and rhythm in every section. */
export default function KitHeading({ heading, text, center = true, className }: KitHeadingProps) {
  // Early returns
  if (!heading && !text) return null

  // Render logic
  return (
    <div
      className={cx('flex flex-col gap-[0.75rem]', center && 'items-center text-center', className)}
    >
      {heading ? <h2 className="section-title text-balance">{heading}</h2> : null}
      <RichCopy value={text} className="text-body max-w-[40rem] text-[var(--color-muted)]" />
    </div>
  )
}
