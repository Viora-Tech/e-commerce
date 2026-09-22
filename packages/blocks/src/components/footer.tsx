// Port of sections/footer.liquid.
export default function Footer({
  storeName,
  tagline,
  columns,
}: {
  storeName: string
  tagline: string
  columns: { heading: string; links: { label: string; href: string }[] }[]
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
          <div
            key={`${c.heading}-${c.links[0]?.href ?? ''}`}
            className="footer__block footer__block--menu"
          >
            <p className="footer__heading">{c.heading}</p>
            <ul className="footer__menu-list">
              {c.links.map((l) => (
                <li key={`${l.href}-${l.label}`}>
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
        <p className="footer__copyright text-caption">
          © {new Date().getFullYear()} {storeName}
        </p>
      </div>
    </footer>
  )
}
