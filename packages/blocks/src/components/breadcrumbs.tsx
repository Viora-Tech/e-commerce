import { breadcrumbsContent as copy } from '../data/breadcrumbs'

type BreadcrumbsProps = {
  /** The trail after Home; the last item is the page itself and is not a link. */
  items: { label: string; href?: string | undefined }[]
}

/** Figma Store / Breadcrumb (692:81537): Home › section › this page, in muted text. */
export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  // Render logic
  const trail = [{ label: copy.home, href: '/' }, ...items]

  return (
    <nav className="breadcrumbs" aria-label={copy.label}>
      <ol className="breadcrumbs__list">
        {trail.map((item, i) => {
          const last = i === trail.length - 1
          return (
            <li key={item.href ?? item.label} className="breadcrumbs__item">
              {i > 0 ? <span className="breadcrumbs__separator" aria-hidden="true" /> : null}
              {last || !item.href ? (
                <span className="breadcrumbs__current" aria-current={last ? 'page' : undefined}>
                  {item.label}
                </span>
              ) : (
                <a href={item.href} className="breadcrumbs__link">
                  {item.label}
                </a>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
