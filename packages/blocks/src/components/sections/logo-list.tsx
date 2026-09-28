import { safeHref } from '../../slot-types'

type Logo = { image: { url: string; alt: string }; href: string }

type Props = { heading: string; logos: Logo[] }

// Port of the Glide logo list: a row of partner or press logos, optionally linked.
export default function LogoList({ heading, logos }: Props) {
  return (
    <div className="logo-list page-width">
      {heading ? <p className="logo-list__heading text-caption">{heading}</p> : null}
      <ul className="logo-list__row">
        {logos.map((l, i) => {
          const href = safeHref(l.href)
          const img = l.image?.url ? (
            <img src={l.image.url} alt={l.image.alt} loading="lazy" />
          ) : null
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
            <li key={`${l.image?.url ?? 'logo'}-${i}`} className="logo-list__item">
              {href ? <a href={href}>{img}</a> : img}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
