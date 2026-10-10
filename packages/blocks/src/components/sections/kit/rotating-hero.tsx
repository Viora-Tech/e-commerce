// Rotating word adapted from Magic UI Word Rotate (MIT), the shared effect
// `../../../effects/word-rotate`; the stacked circles follow Magic UI Avatar Circles (our own
// drawing). Layout is our own. See THIRD_PARTY_NOTICES.md.
import type { ReactNode } from 'react'
import WordRotate from '../../../effects/word-rotate'
import type { Image, Link } from '../../../sections/framed'
import RichCopy from '../../rich-copy'
import KitButtons from './kit-buttons'
import KitMedia from './kit-media'

/** Copy is a string in storage, a React node while edited on the canvas (words stay strings). */
type RotatingHeroProps = {
  before: ReactNode
  words: { word: string }[]
  after: ReactNode
  text: ReactNode
  primary: Link
  proof: ReactNode
  image: Image
  imageSide: 'left' | 'right'
  _aboveFold?: boolean | undefined
}

/** Tints for the stacked circles beside the proof line, all from the theme. */
const CIRCLES = [
  'var(--color-brand)',
  'var(--color-accent)',
  'color-mix(in oklab,var(--color-brand) 55%,var(--color-ink))',
  'color-mix(in oklab,var(--color-accent) 55%,var(--color-ink))',
]

/** A split hero whose headline swaps one word in place, with a small line of social proof. */
export default function RotatingHero({
  before,
  words,
  after,
  text,
  primary,
  proof,
  image,
  imageSide,
  _aboveFold,
}: RotatingHeroProps) {
  // Render logic
  const list = (words ?? []).map((w) => w.word).filter(Boolean)

  return (
    <div className="page-width grid grid-cols-1 items-center gap-[2rem] md:grid-cols-2 md:gap-[3.5rem]">
      <div className={imageSide === 'left' ? 'md:order-2' : undefined}>
        <h1 className="h1 text-balance text-[var(--color-ink)]">
          {before} <WordRotate words={list} className="text-[var(--color-brand)]" /> {after}
        </h1>
        <RichCopy value={text} className="text-body mt-[1rem] text-[var(--color-muted)]" />
        <KitButtons primary={primary} className="mt-[1.5rem]" />
        {proof ? (
          <div className="mt-[1.5rem] flex items-center gap-[0.75rem]">
            <span aria-hidden className="flex">
              {CIRCLES.map((tint) => (
                <span
                  key={tint}
                  className="-ml-[0.5rem] size-[2rem] rounded-full border-2 border-[var(--color-bg)] first:ml-0"
                  style={{ backgroundColor: tint }}
                />
              ))}
            </span>
            <p className="text-small text-[var(--color-muted)]">{proof}</p>
          </div>
        ) : null}
      </div>
      <KitMedia
        image={image}
        className="aspect-[4/5] rounded-[var(--radius-card)] md:aspect-[5/6]"
        sizes="(min-width: 768px) 50vw, 100vw"
        eager={_aboveFold}
      />
    </div>
  )
}
