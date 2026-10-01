// Port of sections/brand-lab.liquid: dark editorial band with an intro and a divided grid of linked brands
import type { ReactNode } from 'react'
import { brandLabContent as copy } from '../../../data/glide/brand-lab'
import { safeHref } from '../../../slot-types'
import Picture from '../../picture'
import RichCopy from '../../rich-copy'

type BrandLabBrand = {
  name: ReactNode
  description: ReactNode
  logo: { url: string; alt: string }
  href: string
}

type BrandLabProps = {
  /** The ReactNode props are strings in storage but React nodes while editing on the canvas. */
  heading: ReactNode
  intro: ReactNode
  ctaLabel: ReactNode
  ctaHref: string
  brands: BrandLabBrand[]
}

/** One brand: its logo, name and line, as a link when it has an address. */
function BrandCell({ brand }: { brand: BrandLabBrand }) {
  const href = safeHref(brand.href)
  const body = (
    <>
      {brand.logo?.url ? (
        <span className="brand-lab__logo">
          <Picture
            image={{ url: brand.logo.url, alt: brand.logo.alt }}
            alt={brand.logo.alt}
            placeholder={false}
            loading="lazy"
          />
        </span>
      ) : null}
      <span className="brand-lab__brand-name h4">{brand.name}</span>
      {brand.description ? (
        <span className="brand-lab__brand-description text-small">{brand.description}</span>
      ) : null}
    </>
  )
  return href ? (
    <a href={href} className="brand-lab__brand">
      {body}
    </a>
  ) : (
    <div className="brand-lab__brand">{body}</div>
  )
}

export default function BrandLab({ heading, intro, ctaLabel, ctaHref, brands }: BrandLabProps) {
  // Render logic
  const named = brands.filter((b) => b.name)
  const cta = safeHref(ctaHref)

  // Early returns
  if (named.length === 0) {
    return (
      <div className="brand-lab color-scheme--dark">
        <div className="brand-lab__inner page-width">
          <p className="brand-lab__empty text-body">{copy.empty}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="brand-lab color-scheme--dark">
      <div className="brand-lab__inner page-width">
        <div className="brand-lab__intro">
          {heading ? <h2 className="brand-lab__heading h2">{heading}</h2> : null}
          <RichCopy value={intro} className="brand-lab__text rte text-body" />
          {cta && ctaLabel ? (
            <a href={cta} className="btn btn--secondary brand-lab__cta">
              {ctaLabel}
            </a>
          ) : null}
        </div>

        <div className="brand-lab__grid">
          {named.map((brand, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: brand blocks have no id and keep their order.
            <BrandCell key={i} brand={brand} />
          ))}
        </div>
      </div>
    </div>
  )
}
