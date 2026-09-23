import type { ThemeMode } from '../types'
import ThemeToggle from './theme-toggle'

// Port of sections/footer.liquid.
export default function Footer({
  storeName,
  tagline,
  columns,
  themeToggle = null,
}: {
  storeName: string
  tagline: string
  columns: { id: string; heading: string; links: { id: string; label: string; href: string }[] }[]
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
        <ul className="footer__policies">
          <li>
            <a href="/policies/privacy" className="footer__policy-link">
              Privacy
            </a>
          </li>
          <li>
            <a href="/policies/returns" className="footer__policy-link">
              Returns
            </a>
          </li>
          <li>
            <a href="/policies/shipping" className="footer__policy-link">
              Shipping
            </a>
          </li>
        </ul>
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
