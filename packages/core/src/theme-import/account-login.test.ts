/** SOURCE OF TRUTH: imported theme account popover tests — `shop | login_button` prints nothing and `routes.storefront_login_url` points at our sign-in page (Horizon's account-actions snippet) */
import { describe, expect, it } from 'vitest'
import { LIQUID_ROUTES } from './drops'
import { createThemeEngine } from './engine'

describe("Horizon's account popover", () => {
  const engine = createThemeEngine(new Map())
  const scope = { routes: LIQUID_ROUTES, shop: { name: 'Claw Gears' } }

  it('prints nothing for the Sign in with Shop button, not "[object Object]"', () => {
    const html = engine.parseAndRenderSync(
      '<account-login-actions>{{ shop | login_button }}</account-login-actions>',
      scope,
    )
    expect(html).toBe('<account-login-actions></account-login-actions>')
  })

  it('links "Sign in" to our sign-in page', () => {
    const html = engine.parseAndRenderSync(
      '<a href="{{ routes.storefront_login_url }}">Sign in</a>',
      scope,
    )
    expect(html).toBe('<a href="/account/login">Sign in</a>')
  })
})
