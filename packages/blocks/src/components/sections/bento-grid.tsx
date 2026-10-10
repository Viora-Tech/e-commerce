// Adapted from Magic UI's Bento Grid (MIT). See THIRD_PARTY_NOTICES.md and
// packages/blocks/THIRD_PARTY_LICENSES.md.

import type { ReactNode } from 'react'
import { focalStyle } from '../../focal-point'
import type { Image } from '../../sections/framed'
import Picture from '../picture'
import RichCopy from '../rich-copy'

/** Copy is a string in storage, a React node while edited on the canvas. */
type Tile = {
  title: ReactNode
  text: ReactNode
  image: Image
  size: 'small' | 'wide' | 'tall'
}

type BentoGridProps = { heading: ReactNode; tiles: Tile[] }

const SIZE_CLASS: Record<Tile['size'], string> = {
  small: 'md:col-span-1 md:row-span-1',
  wide: 'md:col-span-2 md:row-span-1',
  tall: 'md:col-span-1 md:row-span-2',
}

const PLACEHOLDER_GRADIENT =
  'linear-gradient(135deg,color-mix(in_oklab,var(--color-brand)_20%,transparent),color-mix(in_oklab,var(--color-accent)_16%,transparent))'

export default function BentoGrid({ heading, tiles }: BentoGridProps) {
  return (
    <div className="page-width">
      {heading ? <h2 className="h2 text-[var(--color-ink)]">{heading}</h2> : null}
      <div className="mt-[1.5rem] grid grid-cols-1 gap-[1rem] sm:grid-cols-2 md:grid-cols-3 md:auto-rows-[12rem]">
        {tiles.map((tile, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
            key={i}
            className={`group relative flex flex-col justify-end overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-[1.25rem] transition-transform duration-300 ease-out hover:-translate-y-[0.25rem] ${SIZE_CLASS[tile.size]}`}
          >
            {tile.image?.url ? (
              <Picture
                image={tile.image}
                alt={tile.image.alt}
                style={focalStyle(tile.image.focal)}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="absolute inset-0 size-full object-cover opacity-25 transition-opacity duration-300 group-hover:opacity-35"
              />
            ) : (
              <div
                aria-hidden
                className="absolute inset-0 opacity-70"
                style={{ backgroundImage: PLACEHOLDER_GRADIENT }}
              />
            )}
            <div className="relative">
              {tile.title ? <p className="h5 text-[var(--color-ink)]">{tile.title}</p> : null}
              <RichCopy
                value={tile.text}
                className="text-body mt-[0.25rem] text-[var(--color-muted)]"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
