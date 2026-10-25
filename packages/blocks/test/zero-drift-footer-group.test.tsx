import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Footer from '../src/components/footer'
import CookieBanner from '../src/components/sections/zero-drift/cookie-banner'
import { pageAllowed } from '../src/components/sections/zero-drift/signup-popup-timing'
import { EditorSelectionContext } from '../src/editor-selection'
import { createBlocksConfig } from '../src/puck-config'
import type { SectionMetadata } from '../src/sections/dynamic'
import { cookieBannerSettings } from '../src/sections/zero-drift/cookie-banner'
import { footerSettings } from '../src/sections/zero-drift/footer'

const config = createBlocksConfig(async () => [])
const components = config.components as unknown as Record<
  string,
  { render: (p: Record<string, unknown>) => ReactNode; defaultProps: Record<string, unknown> }
>

const render = (type: string, props: Record<string, unknown>, puck: Record<string, unknown>) => {
  const component = components[type]
  if (!component) throw new Error(`${type} is not registered`)
  return renderToStaticMarkup(createElement(() => component.render({ ...props, puck })))
}

const columns = [
  {
    id: 'c1',
    heading: 'Shop',
    links: [{ id: 'l1', label: 'All products', href: '/collections/all' }],
  },
]

const footerMeta = (): SectionMetadata => ({
  renderers: {
    Footer: (s) => (
      <Footer
        {...footerSettings(s)}
        storeName="Waimers"
        columns={columns}
        policies={[{ label: 'Refund policy', href: '/policies/refund-policy' }]}
        cookieSettings={{ label: 'Cookie settings', href: '#cookie-settings' }}
      />
    ),
    CookieBanner: (s) => <CookieBanner {...cookieBannerSettings(s)} />,
  },
})

describe('Footer (Zero Drift footer)', () => {
  it('renders help cards, the brand column, menus, the sign-up, payment chips and policies by default', () => {
    const html = render('Footer', components.Footer?.defaultProps ?? {}, { metadata: footerMeta() })
    expect(html).toContain('footer__help-card')
    expect(html).toContain('Not sure what to buy?')
    expect(html).toContain('footer__brand-name')
    expect(html).toContain('All products')
    expect(html).toContain('Get drops first')
    expect(html).toContain('<li class="footer__payment-chip">UPI</li>')
    expect(html).toContain('Refund policy')
    expect(html).toContain('href="#cookie-settings"')
    expect(html).not.toMatch(/#[0-9a-f]{6}/i)
  })

  it('still renders an old saved { tagline } footer', () => {
    const html = render(
      'Footer',
      { tagline: 'Gaming peripherals built for the grind.' },
      {
        metadata: footerMeta(),
      },
    )
    expect(html).toContain('Gaming peripherals built for the grind.')
    expect(html).toContain('footer__menu-list')
  })

  it('keeps the cookie settings link when policy links and payment icons are hidden', () => {
    const html = render(
      'Footer',
      { showPolicies: false, showPaymentIcons: false, helpCards: [] },
      { metadata: footerMeta() },
    )
    expect(html).not.toContain('Refund policy')
    expect(html).not.toContain('footer__payment')
    expect(html).not.toContain('footer__help')
    expect(html).toContain('Cookie settings')
  })

  it('renders inline-edited copy passed as React nodes', () => {
    const node = (k: string) => createElement('span', { 'data-inline': k }, 'x')
    const html = render(
      'Footer',
      {
        tagline: node('tagline'),
        aboutHeading: node('aboutHeading'),
        helpCards: [{ icon: 'whatsapp', title: node('title'), text: node('text'), link: '' }],
      },
      { metadata: footerMeta() },
    )
    for (const k of ['tagline', 'aboutHeading', 'title', 'text']) {
      expect(html).toContain(`data-inline="${k}"`)
    }
  })

  it('shows social icons only for networks with a safe link', () => {
    const html = render(
      'Footer',
      {
        socials: [
          { platform: 'instagram', url: 'https://instagram.com/waimers' },
          { platform: 'youtube', url: 'javascript:alert(1)' },
        ],
      },
      { metadata: footerMeta() },
    )
    expect(html).toContain('aria-label="Instagram"')
    expect(html).not.toContain('YouTube')
  })
})

describe('Newsletter (Zero Drift newsletter)', () => {
  const meta = { metadata: {} }

  it('renders the card with meteors, interests and the email field', () => {
    const html = render('Newsletter', components.Newsletter?.defaultProps ?? {}, meta)
    expect(html).toContain('newsletter__card')
    expect(html).toContain('meteor-effect')
    expect(html).toContain('Get to know about the latest drops early!')
    expect(html).toContain('value="restock-mice"')
    expect(html).toContain('type="email"')
    expect(html).toContain('01')
  })

  it('still renders an old saved { heading, text, button } section', () => {
    const html = render(
      'Newsletter',
      { heading: 'Join the list', text: 'Drops and restocks.', button: 'Subscribe' },
      meta,
    )
    expect(html).toContain('Join the list')
    expect(html).toContain('Drops and restocks.')
    expect(html).toContain('Subscribe')
    expect(html).not.toContain('newsletter__interests')
  })
})

describe('CookieBanner (Zero Drift cookie banner)', () => {
  it('is a static picture in the admin canvas, with the section labels', () => {
    const html = render('CookieBanner', components.CookieBanner?.defaultProps ?? {}, {
      metadata: footerMeta(),
    })
    expect(html).toContain('cookie-banner--static')
    expect(html).toContain('cookie-banner--bar')
    expect(html).toContain('aria-label="Cookie consent"')
    expect(html).toContain('Accept all')
    expect(html).toContain('Reject all')
    expect(html).toContain('Preferences')
  })

  it('lets the store-level privacy message win and never leaves a button unlabelled', () => {
    const html = renderToStaticMarkup(
      <CookieBanner
        {...cookieBannerSettings({ position: 'left', acceptLabel: '', declineLabel: '' })}
        storeMessage="Store wording"
        onChoose={() => undefined}
      />,
    )
    expect(html).toContain('Store wording')
    expect(html).not.toContain('We use cookies to run the store')
    expect(html).toContain('cookie-banner--left')
    expect(html).not.toContain('cookie-banner--static')
    expect(html).toContain('Accept all')
    expect(html).toContain('Reject all')
  })

  it('opens on the category list, all unticked, when reopened from Cookie settings', () => {
    const html = renderToStaticMarkup(
      <CookieBanner {...cookieBannerSettings({})} startChoosing onChoose={() => undefined} />,
    )
    expect(html).toContain('cookie-banner__panel')
    expect(html.match(/checked=""/g)).toHaveLength(1)
  })
})

describe('SignupPopup (Zero Drift signup popup)', () => {
  it('is a slim strip in the editor until it is selected', () => {
    const html = render(
      'SignupPopup',
      { ...components.SignupPopup?.defaultProps, id: 'pop-1', style: 'corner' },
      { metadata: {}, isEditing: true },
    )
    expect(html).toContain('editor-overlay')
    expect(html).not.toContain('signup-popup__card')
  })

  for (const style of ['corner', 'figure', 'feed'] as const) {
    it(`opens the ${style} look where the store shows it when selected in the editor`, () => {
      const component = components.SignupPopup
      if (!component) throw new Error('SignupPopup is not registered')
      const html = renderToStaticMarkup(
        createElement(
          EditorSelectionContext.Provider,
          { value: 'pop-1' },
          createElement(() =>
            component.render({
              ...component.defaultProps,
              id: 'pop-1',
              style,
              puck: { metadata: {}, isEditing: true },
            }),
          ),
        ),
      )
      expect(html).toContain(`signup-popup--${style}`)
      expect(html).not.toContain('signup-popup--editing')
      expect(html).toContain('is-open')
      expect(html).not.toContain('hidden=""')
      expect(html).toContain('<em>₹100 off</em>')
      expect(html).not.toContain('signup-popup__scrim')
    })
  }

  it('starts hidden on the storefront until its moment comes', () => {
    const html = render(
      'SignupPopup',
      { ...components.SignupPopup?.defaultProps, style: 'figure' },
      { metadata: {} },
    )
    expect(html).toContain('hidden=""')
    expect(html).toContain('signup-popup__scrim')
  })

  it('stays away from the cart and account, and honours chosen collections', () => {
    expect(pageAllowed('all', '', '/products/x')).toBe(true)
    expect(pageAllowed('all', '', '/cart')).toBe(false)
    expect(pageAllowed('all', '', '/account/orders')).toBe(false)
    expect(pageAllowed('collections', 'preorder, holidays-sale', '/collections/preorder')).toBe(
      true,
    )
    expect(pageAllowed('collections', 'preorder', '/collections/mice')).toBe(false)
    expect(pageAllowed('collections', 'preorder', '/')).toBe(false)
  })
})
