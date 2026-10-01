import type { ComponentConfig } from '@puckeditor/core'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Header from '../src/components/header'
import { announcementBarContent } from '../src/data/glide/announcement-bar'
import { mobileDockContent } from '../src/data/glide/mobile-dock'
import { searchShortcuts } from '../src/header-menu'
import { createBlocksConfig } from '../src/puck-config'
import { headerSettings } from '../src/sections/glide/header'
import type { NavLink } from '../src/types'

const config = createBlocksConfig(async () => [])
const puck = { metadata: {} }

function renderSection(type: string, props: Record<string, unknown>, metadata = {}) {
  const component = (config.components as unknown as Record<string, ComponentConfig | undefined>)[
    type
  ]
  if (!component) throw new Error(`${type} is not registered`)
  const merged = { ...(component.defaultProps as Record<string, unknown>), ...props }
  const render = component.render as unknown as (p: Record<string, unknown>) => ReactElement
  return renderToStaticMarkup(render({ ...merged, puck: { ...puck, metadata } }))
}

const links: NavLink[] = [
  {
    id: 'shop',
    label: 'Shop',
    href: '/collections/all',
    children: [
      { id: 'mice', label: 'Mice', href: '/collections/mice' },
      { id: 'pads', label: 'Pads', href: '/collections/pads' },
    ],
  },
  {
    id: 'explore',
    label: 'Explore',
    href: '/pages/explore',
    children: [{ id: 'about', label: 'About', href: '/pages/about' }],
  },
  {
    id: 'brands',
    label: 'Brands',
    href: '/collections/brands',
    children: [
      { id: 'lofree', label: 'Lofree', href: '/collections/lofree' },
      { id: 'blog', label: 'Blog', href: '/blogs/news' },
    ],
  },
  { id: 'sale', label: 'Sale', href: '/collections/sale' },
]

const headerProps = {
  storeName: 'Waimers',
  links,
  themeMode: 'light' as const,
  showThemeToggle: true,
  cartCount: 2,
}

describe('AnnouncementBar (Glide header group)', () => {
  it('renders the theme announcements as a marquee by default', () => {
    const html = renderSection('AnnouncementBar', {})
    expect(html).toContain('announcement-bar--marquee')
    expect(html).toContain('color-scheme-4')
    expect(html).toContain('3% Discount on all UPI ID Transactions.')
    expect(html).toContain('href="/collections/lofree"')
    // Magic UI Marquee: a second, inert copy of the messages.
    expect(html).toContain('aria-hidden="true"')
    expect(html).not.toContain('src=""')
  })

  it('rotates one message at a time with prev/next controls', () => {
    const html = renderSection('AnnouncementBar', { displayMode: 'rotate' })
    expect(html).toContain('announcement-bar--rotate')
    expect(html).toContain(announcementBarContent.next)
    expect(html.match(/announcement-bar__item is-active/g)).toHaveLength(1)
  })

  it('still renders a bar saved before the port ({ text, link, scheme })', () => {
    const html = renderSection('AnnouncementBar', {
      text: 'Free shipping over Rs 999',
      link: { label: 'Shop now', href: '/collections/all' },
      scheme: 'scheme-3',
    })
    expect(html).toContain('Free shipping over Rs 999')
    expect(html).toContain('href="/collections/all"')
    expect(html).toContain('color-scheme-3')
    expect(html).not.toContain('3% Discount')
    expect(html).not.toContain(announcementBarContent.next)
  })

  it('rewrites a legacy bar into announcements when the editor resolves it', async () => {
    const resolve = config.components.AnnouncementBar?.resolveData
    if (!resolve) throw new Error('AnnouncementBar has no resolveData')
    // @ts-expect-error -- only the props are read
    const result = await resolve({ props: { text: 'Hi', link: { label: 'Go', href: '/x' } } }, {})
    expect(result.props).toMatchObject({
      text: '',
      announcements: [{ text: 'Hi', link: '/x' }],
      displayMode: 'rotate',
    })
  })

  it('shows social links only when switched on', () => {
    const socials = [{ platform: 'discord', url: 'https://discord.gg/x' }]
    expect(renderSection('AnnouncementBar', { socials })).toContain('https://discord.gg/x')
    expect(renderSection('AnnouncementBar', { socials, showSocial: false })).not.toContain(
      'discord.gg',
    )
  })

  it('renders inline-edited messages as React nodes', () => {
    const node = createElement('span', { 'data-inline': 'text' }, 'x')
    const html = renderSection('AnnouncementBar', { announcements: [{ text: node, link: '' }] })
    expect(html).toContain('data-inline')
  })
})

describe('Header (Glide header group)', () => {
  it('still renders a header saved as { menu }', () => {
    const html = renderToStaticMarkup(
      <Header {...headerProps} settings={headerSettings({ menu: 'main-menu' })} />,
    )
    expect(html).toContain('header__row--logo-center')
    expect(html).toContain('data-sticky-type="always"')
    expect(html).toContain('Shop')
    expect(html).toContain('header__cart-count')
  })

  it('draws the new settings: logo position, sticky, hover look, wishlist', () => {
    const settings = headerSettings({
      logoPosition: 'left',
      sticky: 'on-scroll-up',
      menuHover: 'pill',
      showWishlist: true,
    })
    const html = renderToStaticMarkup(<Header {...headerProps} settings={settings} />)
    expect(html).toContain('header__row--logo-left')
    expect(html).toContain('data-sticky-type="on-scroll-up"')
    expect(html).toContain('has-nav-pill')
    expect(html).toContain('href="/pages/wishlist"')
    expect(
      renderToStaticMarkup(
        <Header {...headerProps} settings={headerSettings({ showWishlist: false })} />,
      ),
    ).not.toContain('/pages/wishlist')
  })

  it('puts curated feature cards and collection images in the dropdowns', () => {
    const settings = headerSettings({})
    const html = renderToStaticMarkup(
      <Header
        {...headerProps}
        settings={settings}
        collections={[{ handle: 'mice', title: 'Mice', imageUrl: '/media/mice.jpg' }]}
      />,
    )
    // The theme's quiz card, under Explore, as a dark text card.
    expect(html).toContain('Take the 2-minute quiz')
    expect(html).toContain('header__expansion-card--text')
    // Shop's child collection lends its image.
    expect(html).toContain('src="/media/mice.jpg"')
    const off = renderToStaticMarkup(
      <Header
        {...headerProps}
        settings={headerSettings({ showMenuImages: false })}
        collections={[{ handle: 'mice', title: 'Mice', imageUrl: '/media/mice.jpg' }]}
      />,
    )
    expect(off).not.toContain('header__expansion-card')
  })

  it('renders feature card copy passed as editor nodes', () => {
    const node = createElement('span', { 'data-inline': 'label' }, 'x')
    const settings = headerSettings({
      featureCards: [{ menuItem: 'shop', label: node, eyebrow: node, link: '/x', style: 'light' }],
    })
    const html = renderToStaticMarkup(<Header {...headerProps} settings={settings} />)
    expect(html).toContain('data-inline')
  })

  it('builds the search pills from popular terms and the Brands menu', () => {
    const { popular, brands } = searchShortcuts('new arrivals, sale', [], links, [])
    expect(popular).toEqual([
      { label: 'new arrivals', href: '/search?q=new%20arrivals' },
      { label: 'sale', href: '/search?q=sale' },
    ])
    expect(brands).toEqual([{ label: 'Lofree', href: '/collections/lofree' }])
    const picked = searchShortcuts('', [{ handle: 'mice' }], links, [
      { handle: 'mice', title: 'Mice', imageUrl: null },
    ])
    expect(picked.brands).toEqual([{ label: 'Mice', href: '/collections/mice' }])
  })
})

describe('MobileDock (Glide footer group)', () => {
  it('renders the theme links and the cart last', () => {
    const html = renderSection('MobileDock', {})
    for (const link of mobileDockContent.links) expect(html).toContain(`href="${link.url}"`)
    expect(html.lastIndexOf('href="/cart"')).toBeGreaterThan(html.indexOf('href="/account"'))
    expect(html).not.toContain('mobile-dock__cart-count')
  })

  it('shows the cart count the storefront hands the footer group', () => {
    const html = renderSection('MobileDock', {}, { appBlockContext: { cartCount: 3 } })
    expect(html).toContain('mobile-dock__cart-count">3<')
  })

  it('skips a link with no label and renders inline-edited labels', () => {
    const node = createElement('span', { 'data-inline': 'label' }, 'x')
    const html = renderSection('MobileDock', {
      links: [
        { icon: 'heart', label: '', url: '/pages/wishlist' },
        { icon: 'user', label: node, url: '/account' },
      ],
    })
    expect(html).not.toContain('/pages/wishlist')
    expect(html).toContain('data-inline')
  })
})
