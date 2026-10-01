import { footerContent as copy } from '../data/glide/footer'
import type { PaymentMethod } from '../sections/glide/footer'
import type { ThemeMode } from '../types'
import Icon from './icon'
import PaymentIcon from './payment-icon'
import ThemeToggle from './theme-toggle'

type FooterBottomProps = {
  storeName: string
  policies: { label: string; href: string }[]
  cookieSettings: { label: string; href: string } | null
  grievance: string | null
  themeToggle: ThemeMode | null
  paymentIcons: { method: PaymentMethod }[]
}

const paymentLabel = (method: PaymentMethod) =>
  copy.paymentOptions.find((o) => o.value === method)?.label ?? method

// The footer's bottom bar (sections/footer.liquid): payment marks, policy links, the
// grievance officer, the theme toggle, the copyright line and "Back to top".
export default function FooterBottom({
  storeName,
  policies,
  cookieSettings,
  grievance,
  themeToggle,
  paymentIcons,
}: FooterBottomProps) {
  // Render logic
  const links = cookieSettings ? [...policies, cookieSettings] : policies

  return (
    <div className="footer__bottom page-width">
      {paymentIcons.length > 0 ? (
        <ul className="footer__payment" aria-label={copy.paymentMethods}>
          {paymentIcons.map((p) => (
            <li key={p.method}>
              <PaymentIcon method={p.method} label={paymentLabel(p.method)} />
            </li>
          ))}
        </ul>
      ) : null}
      {links.length > 0 ? (
        <ul className="footer__policies">
          {links.map((p) => (
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
      <a className="footer__top-link text-caption" href="#MainContent">
        {copy.backToTop}
        <span className="footer__top-icon" aria-hidden="true">
          <Icon name="arrow" size={14} />
        </span>
      </a>
    </div>
  )
}
