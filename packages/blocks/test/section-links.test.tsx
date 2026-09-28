import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import AnnouncementBar from '../src/components/sections/announcement-bar'
import ImageBanner from '../src/components/sections/image-banner'
import { safeHref } from '../src/slot-types'

describe('safeHref', () => {
  it.each([
    '/collections/all',
    '/policies/refund-policy',
    '#section',
    'https://example.com/x',
    'mailto:hi@example.com',
    'tel:+911234567890',
  ])('keeps %s', (href) => {
    expect(safeHref(href)).toBe(href)
  })

  it.each([
    '/\\evil.com',
    '//evil.com',
    '/\t/evil.com',
    'data:text/html,x',
    'javascript:alert(1)',
    'vbscript:x',
    '',
    42,
  ])('drops %s', (href) => {
    expect(safeHref(href)).toBeNull()
  })
})

describe('section links render through safeHref', () => {
  it('never draws a data: or backslash href', () => {
    const banner = renderToStaticMarkup(
      <ImageBanner
        image={{ url: '', alt: '' } as never}
        heading="Sale"
        text=""
        button={{ label: 'Shop', href: 'data:text/html,<script>alert(1)</script>' }}
        height="small"
        align="left"
        overlay={0}
      />,
    )
    expect(banner).not.toContain('data:')
    expect(banner).toContain('href="/collections/all"')

    const bar = renderToStaticMarkup(
      <AnnouncementBar text="Hi" link={{ label: 'Go', href: '/\\evil.com' }} />,
    )
    expect(bar).not.toContain('evil.com')
    expect(bar).not.toContain('<a')
  })

  it('keeps a site path', () => {
    const bar = renderToStaticMarkup(
      <AnnouncementBar text="Hi" link={{ label: 'Go', href: '/policies/shipping-policy' }} />,
    )
    expect(bar).toContain('href="/policies/shipping-policy"')
  })
})
