// Pattern after common feature-with-image layouts (our own implementation). See
// THIRD_PARTY_NOTICES.md.
import type { ReactNode } from 'react'
import type { Image, Link } from '../../../sections/framed'
import Icon from '../../icon'
import RichCopy from '../../rich-copy'
import KitButtons from './kit-buttons'
import KitMedia from './kit-media'

/** Copy is a string in storage, a React node while edited on the canvas. */
type FeatureChecklistProps = {
  eyebrow: ReactNode
  heading: ReactNode
  text: ReactNode
  points: { text: ReactNode }[]
  primary: Link
  image: Image
  imageSide: 'left' | 'right'
}

/** A picture beside a heading and a short list of ticked points. */
export default function FeatureChecklist({
  eyebrow,
  heading,
  text,
  points,
  primary,
  image,
  imageSide,
}: FeatureChecklistProps) {
  // Render logic
  return (
    <div className="page-width grid grid-cols-1 items-center gap-[2rem] md:grid-cols-2 md:gap-[3.5rem]">
      <KitMedia
        image={image}
        className={
          imageSide === 'right'
            ? 'aspect-[4/3] rounded-[var(--radius-card)] md:order-2'
            : 'aspect-[4/3] rounded-[var(--radius-card)]'
        }
        sizes="(min-width: 768px) 50vw, 100vw"
      />
      <div className="flex flex-col items-start gap-[1rem] text-left">
        {eyebrow ? (
          <p className="text-caption uppercase tracking-[0.08em] text-[var(--color-brand)]">
            {eyebrow}
          </p>
        ) : null}
        {heading ? <h2 className="h2 text-balance text-[var(--color-ink)]">{heading}</h2> : null}
        <RichCopy value={text} className="text-body text-[var(--color-muted)]" />
        {points?.length ? (
          <ul className="flex flex-col gap-[0.75rem]">
            {points.map((point, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
              <li key={i} className="flex items-start gap-[0.75rem]">
                <span className="mt-[0.125rem] flex size-[1.25rem] shrink-0 items-center justify-center rounded-full bg-[var(--color-brand)] text-[var(--color-on-brand)]">
                  <Icon name="check" size={12} />
                </span>
                <span className="text-body text-[var(--color-ink)]">{point.text}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <KitButtons primary={primary} className="mt-[0.5rem]" />
      </div>
    </div>
  )
}
