/** SOURCE OF TRUTH: account sections nav — WHAT: Points shows only with the Loyalty points app / WHY: the way shoppers reach /account/points on every theme, imported Liquid ones included (the nav is ours, drawn inside the theme's header and footer) */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ usePathname: () => '/account' }))
vi.mock('@/lib/account-actions', () => ({ signOutAction: vi.fn() }))
const { default: AccountNav } = await import('./account-nav')

describe('AccountNav', () => {
  it('links Points after Store credit when the store has the app', () => {
    const html = renderToStaticMarkup(
      createElement(AccountNav, { email: 'a@b.in', name: null, showPoints: true }),
    )
    expect(html).toContain('href="/account/points"')
    expect(html.indexOf('/account/store-credit')).toBeLessThan(html.indexOf('/account/points'))
  })

  it('has no Points link without the app', () => {
    const html = renderToStaticMarkup(createElement(AccountNav, { email: 'a@b.in', name: null }))
    expect(html).not.toContain('/account/points')
  })
})
