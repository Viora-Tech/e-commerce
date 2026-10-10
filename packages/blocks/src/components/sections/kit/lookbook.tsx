// Pattern after common lookbook and masonry gallery layouts (our own implementation). See
// THIRD_PARTY_NOTICES.md.
import type { ReactNode } from 'react'
import { focalStyle } from '../../../focal-point'
import { linkTarget } from '../../../link'
import type { Image } from '../../../sections/framed'
import { cx, safeHref } from '../../../slot-types'
import Picture from '../../picture'
import KitHeading from './kit-heading'

/** Copy is a string in storage, a React node while edited on the canvas. */
type LookbookProps = {
  heading: ReactNode
  text: ReactNode
  photos: { image: Image; caption: ReactNode; href: string }[]
}

/** Shapes that repeat down the wall, so it reads as a lookbook rather than a grid. */
const SHAPES = ['aspect-[4/5]', 'aspect-square', 'aspect-[3/4]', 'aspect-[4/3]', 'aspect-[4/5]']

const PLACEHOLDER =
  'linear-gradient(160deg,color-mix(in oklab,var(--color-brand) 18%,var(--color-surface)),color-mix(in oklab,var(--color-accent) 14%,var(--color-surface)))'

/** Photos in a masonry wall, each with a caption; a photo with a link zooms gently on hover. */
export default function Lookbook({ heading, text, photos }: LookbookProps) {
  // Early returns
  if (!photos?.length) return null

  // Render logic
  return (
    <div className="page-width flex flex-col gap-[2.5rem]">
      <KitHeading heading={heading} text={text} />
      <ul className="columns-2 gap-[1rem] md:columns-3">
        {photos.map((photo, i) => {
          const href = safeHref(photo.href)
          const shape = SHAPES[i % SHAPES.length]
          const picture = (
            <figure className="flex flex-col gap-[0.625rem] text-left">
              <span
                className={cx(
                  'relative block w-full overflow-hidden rounded-[var(--radius-card)]',
                  shape,
                )}
                style={photo.image?.url ? undefined : { backgroundImage: PLACEHOLDER }}
              >
                {photo.image?.url ? (
                  <Picture
                    image={photo.image}
                    alt={photo.image.alt}
                    className="absolute inset-0 size-full object-cover transition-[scale] duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
                    style={focalStyle(photo.image.focal)}
                    fill
                    sizes="(min-width: 768px) 33vw, 50vw"
                  />
                ) : null}
              </span>
              {photo.caption ? (
                <figcaption className="text-small text-[var(--color-ink)]">
                  {photo.caption}
                </figcaption>
              ) : null}
            </figure>
          )
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
            <li key={i} className="group mb-[1rem] break-inside-avoid">
              {href ? (
                <a href={href} {...linkTarget({ label: '', href })}>
                  {picture}
                </a>
              ) : (
                picture
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
