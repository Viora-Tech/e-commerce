// Background adapted from Magic UI Retro Grid (MIT): the shared effect `../../../effects/retro-grid`.
// Layout is our own. See THIRD_PARTY_NOTICES.md.
import type { ReactNode } from 'react'
import RetroGrid from '../../../effects/retro-grid'
import type { Link } from '../../../sections/framed'
import RichCopy from '../../rich-copy'
import KitButtons from './kit-buttons'

/** Copy is a string in storage, a React node while edited on the canvas. */
type GridHeroProps = {
  badge: ReactNode
  heading: ReactNode
  text: ReactNode
  primary: Link
  secondary: Link
}

/** A centred hero over a perspective grid floor that drifts toward the shopper. */
export default function GridHero({ badge, heading, text, primary, secondary }: GridHeroProps) {
  // Render logic
  return (
    <div className="relative isolate flex min-h-[32rem] w-full items-center justify-center overflow-hidden bg-[var(--color-bg)] px-[1rem] py-[5rem] text-center">
      <RetroGrid />
      <div className="page-width relative flex max-w-[48rem] flex-col items-center gap-[1.25rem]">
        {badge ? (
          <span className="text-caption inline-flex items-center gap-[0.5rem] rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-[0.875rem] py-[0.375rem] text-[var(--color-muted)]">
            <span aria-hidden className="size-[0.375rem] rounded-full bg-[var(--color-brand)]" />
            {badge}
          </span>
        ) : null}
        {heading ? <h1 className="h1 text-balance text-[var(--color-ink)]">{heading}</h1> : null}
        <RichCopy value={text} className="text-body max-w-[36rem] text-[var(--color-muted)]" />
        <KitButtons primary={primary} secondary={secondary} center className="mt-[0.5rem]" />
      </div>
    </div>
  )
}
