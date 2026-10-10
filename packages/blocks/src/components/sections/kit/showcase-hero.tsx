// The moving light on the frame is adapted from Magic UI Border Beam (MIT), the shared effect
// `../../../effects/border-beam`. Layout is our own. See THIRD_PARTY_NOTICES.md.
import type { ReactNode } from 'react'
import BorderBeam from '../../../effects/border-beam'
import type { Image, Link } from '../../../sections/framed'
import RichCopy from '../../rich-copy'
import KitButtons from './kit-buttons'
import KitMedia from './kit-media'

/** Copy is a string in storage, a React node while edited on the canvas. */
type ShowcaseHeroProps = {
  eyebrow: ReactNode
  heading: ReactNode
  text: ReactNode
  primary: Link
  secondary: Link
  image: Image
  beam: boolean
  _aboveFold?: boolean | undefined
}

/** Centred launch copy above one large framed picture, with an optional light running round it. */
export default function ShowcaseHero({
  eyebrow,
  heading,
  text,
  primary,
  secondary,
  image,
  beam,
  _aboveFold,
}: ShowcaseHeroProps) {
  // Render logic
  return (
    <div className="page-width flex flex-col items-center gap-[2.5rem] text-center">
      <div className="flex max-w-[44rem] flex-col items-center gap-[1rem]">
        {eyebrow ? (
          <p className="text-caption uppercase tracking-[0.08em] text-[var(--color-brand)]">
            {eyebrow}
          </p>
        ) : null}
        {heading ? <h1 className="h1 text-balance text-[var(--color-ink)]">{heading}</h1> : null}
        <RichCopy value={text} className="text-body text-[var(--color-muted)]" />
        <KitButtons primary={primary} secondary={secondary} center className="mt-[0.5rem]" />
      </div>
      <div className="relative w-full rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-[0.5rem] shadow-[0_1.5rem_4rem_-1.5rem_color-mix(in_oklab,var(--color-ink)_25%,transparent)]">
        <KitMedia
          image={image}
          className="aspect-[16/9] rounded-[calc(var(--radius-card)-0.375rem)]"
          sizes="(min-width: 1200px) 1200px, 100vw"
          eager={_aboveFold}
        />
        {beam ? <BorderBeam /> : null}
      </div>
    </div>
  )
}
