import type { ThemeMode } from '../types'
import ThemeToggle from './theme-toggle'

// Port of sections/footer.liquid.
export default function Footer({
  storeName,
  tagline,
  columns,
  policies = [],
  grievance = null,
  themeToggle = null,
}: {
  storeName: string
  tagline: string
  columns: { id: string; heading: string; links: { id: string; label: string; href: string }[] }[]
  /** The store's published policies (Settings → Policies), in order; none renders no list. */
  policies?: { label: string; href: string }[]
  /** One line naming the grievance officer and how to reach them, when the store has one. */
  grievance?: string | null
  /** The visitor's mode when the theme puts the light / dark toggle in the footer. */
  themeToggle?: ThemeMode | null
}) {
  return (
    <footer className="footer color-scheme-3">
      <div
        className="footer__top page-width"
        style={{ '--footer-columns': columns.length + 1 } as React.CSSProperties}
      >
        <div className="footer__block footer__block--text footer__block--wide">
          <p className="footer__heading">{storeName}</p>
          <div className="footer__text text-small">
            <p>{tagline}</p>
          </div>
        </div>
        {columns.map((c) => (
          <div key={c.id} className="footer__block footer__block--menu">
            <p className="footer__heading">{c.heading}</p>
            <ul className="footer__menu-list">
              {c.links.map((l) => (
                <li key={l.id}>
                  <a href={l.href} className="footer__menu-link">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="footer__bottom page-width">
        {policies.length > 0 ? (
          <ul className="footer__policies">
            {policies.map((p) => (
              <li key={p.href}>
                <a href={p.href} className="footer__policy-link">
                  {p.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {grievance ? <p className="footer__grievance text-caption">{grievance}</p> : null}
        {themeToggle ? (
          <ThemeToggle
            initial={themeToggle}
            withLabel
            className="footer__theme-toggle text-caption"
          />
        ) : null}
        <p className="footer__copyright text-caption">
          © {new Date().getFullYear()} {storeName}
        </p>
      </div>
    </footer>
  )
}
