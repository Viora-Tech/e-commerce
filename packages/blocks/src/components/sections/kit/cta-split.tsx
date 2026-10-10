// Pattern after common split call-to-action layouts (our own implementation). See
// THIRD_PARTY_NOTICES.md.
import type { ReactNode } from 'react'
import type { Image, Link } from '../../../sections/framed'
import RichCopy from '../../rich-copy'
import KitButtons from './kit-buttons'
import KitMedia from './kit-media'

/** Copy is a string in storage, a React node while edited on the canvas. */
type CtaSplitProps = {
  eyebrow: ReactNode
  heading: ReactNode
  text: ReactNode
  primary: Link
  image: Image
  imageSide: 'left' | 'right'
}

/** One card: a picture on one side, a short offer and a button on the other. */
export default function CtaSplit({
  eyebrow,
  heading,
  text,
  primary,
  image,
  imageSide,
}: CtaSplitProps) {
  // Render logic
  return (
    <div className="page-width">
      <div className="grid grid-cols-1 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] md:grid-cols-2">
        <KitMedia
          image={image}
          className={
            imageSide === 'right'
              ? 'aspect-[4/3] md:order-2 md:aspect-auto md:h-full md:min-h-[22rem]'
              : 'aspect-[4/3] md:aspect-auto md:h-full md:min-h-[22rem]'
          }
          sizes="(min-width: 768px) 50vw, 100vw"
        />
        <div className="flex flex-col items-start justify-center gap-[1rem] p-[1.75rem] text-left md:p-[3rem]">
          {eyebrow ? (
            <p className="text-caption uppercase tracking-[0.08em] text-[var(--color-brand)]">
              {eyebrow}
            </p>
          ) : null}
          {heading ? <h2 className="h2 text-balance text-[var(--color-ink)]">{heading}</h2> : null}
          <RichCopy value={text} className="text-body text-[var(--color-muted)]" />
          <KitButtons primary={primary} className="mt-[0.5rem]" />
        </div>
      </div>
    </div>
  )
}
