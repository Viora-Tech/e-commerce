import type { CSSProperties } from 'react'
import type { FooterSettings } from '../sections/zero-drift/footer'
import { safeHref } from '../slot-types'
import type { ThemeMode } from '../types'
import FooterBottom from './footer-bottom'
import Icon from './icon'
import RichCopy from './rich-copy'
import SocialLinks from './social-links'

type FooterProps = FooterSettings & {
  storeName: string
  /** The store's footer menus, one column per parent link. */
  columns: { id: string; heading: string; links: { id: string; label: string; href: string }[] }[]
  /** The store's published policies (Settings → Policies), in order; none renders no list. */
  policies?: { label: string; href: string }[]
  /** "Cookie settings": reopens the consent banner, so it shows even with policy links hidden. */
  cookieSettings?: { label: string; href: string } | null
  /** One line naming the grievance officer and how to reach them, when the store has one. */
  grievance?: string | null
  /** The visitor's mode when the theme puts the light / dark toggle in the footer. */
  themeToggle?: ThemeMode | null
  /** The theme's logo, drawn over the about text when the section shows it. */
  logo?: { url: string; width: number; height?: number | undefined } | null
}

const external = (href: string) => /^https?:\/\//i.test(href)

// Port of sections/footer.liquid: help cards, the about column, the store's menu columns
// (accordions on phones) and the bottom bar.
export default function Footer({
  storeName,
  columns,
  policies = [],
  cookieSettings = null,
  grievance = null,
  themeToggle = null,
  logo = null,
  helpCards,
  aboutHeading,
  tagline,
  showLogo,
  wide,
  showSocial,
  socials,
  showPaymentIcons,
  paymentIcons,
  showPolicies,
}: FooterProps) {
  // Render logic
  const span = wide ? 2 : 1
  const gridColumns = Math.min(6, Math.max(2, columns.length + span))

  return (
    <footer className="footer color-scheme-3">
      <div
        className="footer__top page-width"
        style={{ '--footer-columns': gridColumns } as CSSProperties}
      >
        {helpCards.length > 0 ? (
          <div className="footer__help">
            {helpCards.map((card, i) => {
              const href = safeHref(card.link)
              return (
                <a
                  // biome-ignore lint/suspicious/noArrayIndexKey: cards have no id; the editor reorders by position.
                  key={i}
                  className="footer__help-card"
                  href={href ?? undefined}
                  {...(href && external(href)
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                >
                  <span className="footer__help-icon" aria-hidden="true">
                    <Icon name={card.icon} size={20} />
                  </span>
                  <span className="footer__help-copy">
                    <span className="footer__help-title">{card.title}</span>
                    {card.text ? <span className="footer__help-text">{card.text}</span> : null}
                  </span>
                  <span className="footer__help-arrow" aria-hidden="true">
                    <Icon name="arrow" size={16} />
                  </span>
                </a>
              )
            })}
          </div>
        ) : null}
        <div className={`footer__block footer__block--text${wide ? ' footer__block--wide' : ''}`}>
          {showLogo && logo ? (
            <a href="/" className="footer__logo">
              <img
                src={logo.url}
                alt={storeName}
                width={logo.width}
                height={logo.height}
                loading="lazy"
                className="footer__logo-image"
              />
            </a>
          ) : null}
          <p className="footer__heading">{aboutHeading || storeName}</p>
          <RichCopy value={tagline} className="footer__text text-small" />
          {showSocial ? <SocialLinks links={socials} /> : null}
        </div>
        {columns.map((c) => (
          <div key={c.id} className="footer__block footer__block--menu">
            <details className="footer__accordion">
              <summary className="footer__heading footer__accordion-toggle">
                {c.heading}
                <span className="footer__accordion-icon">
                  <Icon name="chevron-down" size={16} />
                </span>
              </summary>
              <ul className="footer__menu-list">
                {c.links.map((l) => (
                  <li key={l.id}>
                    <a href={l.href} className="footer__menu-link">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        ))}
      </div>
      <FooterBottom
        storeName={storeName}
        policies={showPolicies ? policies : []}
        cookieSettings={cookieSettings}
        grievance={grievance}
        themeToggle={themeToggle}
        paymentIcons={showPaymentIcons ? paymentIcons : []}
      />
    </footer>
  )
}
