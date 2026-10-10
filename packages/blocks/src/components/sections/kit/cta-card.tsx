// The moving light on the border is adapted from Magic UI Border Beam (MIT), the shared effect
// `../../../effects/border-beam`. Card layout is our own. See THIRD_PARTY_NOTICES.md.
import type { ReactNode } from 'react'
import BorderBeam from '../../../effects/border-beam'
import type { Link } from '../../../sections/framed'
import RichCopy from '../../rich-copy'
import KitButtons from './kit-buttons'

/** Copy is a string in storage, a React node while edited on the canvas. */
type CtaCardProps = {
  heading: ReactNode
  text: ReactNode
  primary: Link
  secondary: Link
  beam: boolean
}

const DOTS =
  'radial-gradient(circle,color-mix(in oklab,var(--color-ink) 12%,transparent) 1px,transparent 1px)'

/** A centred closing card over a faint dot pattern, with an optional light running round it. */
export default function CtaCard({ heading, text, primary, secondary, beam }: CtaCardProps) {
  // Render logic
  return (
    <div className="page-width">
      <div className="relative isolate flex justify-center overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] px-[1.5rem] py-[3.5rem] text-center md:px-[3rem] md:py-[4.5rem]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
          style={{ backgroundImage: DOTS, backgroundSize: '1.25rem 1.25rem' }}
        />
        {/* Centred by the card's flex, not auto margins: the theme's base CSS resets margins. */}
        <div className="flex w-full max-w-[40rem] flex-col items-center gap-[1rem]">
          {heading ? <h2 className="h2 text-balance text-[var(--color-ink)]">{heading}</h2> : null}
          <RichCopy value={text} className="text-body text-[var(--color-muted)]" />
          <KitButtons primary={primary} secondary={secondary} center className="mt-[0.5rem]" />
        </div>
        {beam ? <BorderBeam durationSeconds={10} /> : null}
      </div>
    </div>
  )
}
