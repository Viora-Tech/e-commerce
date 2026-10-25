import type { ReactNode } from 'react'
import { promoBentoContent as copy } from '../../../data/zero-drift/promo-bento'
import PromoTile, { type PromoTileView } from './promo-tile'

type PromoBentoProps = {
  heading: ReactNode
  subheading: ReactNode
  textReveal: string
  tiles: PromoTileView[]
}

// Port of sections/promo-bento.liquid: a merchant-composed mosaic where each tile carries its own span on a 4-column grid.
export default function PromoBento({ heading, subheading, textReveal, tiles }: PromoBentoProps) {
  // Early returns
  if (tiles.length === 0) return <p className="promo-bento__empty">{copy.empty}</p>

  // Render logic
  return (
    <div className="section-promo-bento">
      {heading || subheading ? (
        <div className="promo-bento__head">
          {heading ? <h2 className="promo-bento__heading h2">{heading}</h2> : null}
          {subheading ? <p className="promo-bento__subheading">{subheading}</p> : null}
        </div>
      ) : null}
      <div className="promo-bento__inner">
        <div className="promo-bento__grid">
          {tiles.map((tile, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: tiles have no id and are reordered only in the editor.
            <PromoTile key={i} tile={tile} reveal={textReveal} />
          ))}
        </div>
      </div>
    </div>
  )
}
