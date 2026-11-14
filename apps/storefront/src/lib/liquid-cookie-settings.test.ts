import { showsCookieSettingsLink } from '@commerce/core/theme-import'
import { describe, expect, it } from 'vitest'
import { withCookieSettingsLink } from './liquid-cookie-settings'

const FOOTER =
  '<footer class="footer"><div class="footer__bottom"><ul class="footer__policies"><li><a href="/policies/refund-policy" class="footer__policy-link">Refund policy</a></li></ul><p class="footer__copyright">© 2026</p></div></footer>'

describe('withCookieSettingsLink', () => {
  it('adds Cookie settings as the last policy link, styled like its neighbours', () => {
    const html = withCookieSettingsLink(FOOTER, 'Cookie settings')
    expect(html).toContain(
      '<li><a href="/policies/refund-policy" class="footer__policy-link">Refund policy</a></li><li><a href="#cookie-settings" class="footer__policy-link">Cookie settings</a></li></ul>',
    )
    expect(html.match(/#cookie-settings/g)).toHaveLength(1)
  })

  it('falls back to a line at the end of a footer with no policy list', () => {
    const html = withCookieSettingsLink('<footer><p>© Shop</p></footer>', 'Cookie settings')
    expect(html).toBe(
      '<footer><p>© Shop</p><p class="cookie-settings-link"><a href="#cookie-settings">Cookie settings</a></p></footer>',
    )
  })

  it('leaves a footer that already links to cookie settings alone', () => {
    const own = '<footer><a href="#cookie-settings">Privacy choices</a></footer>'
    expect(withCookieSettingsLink(own, 'Cookie settings')).toBe(own)
  })

  it('escapes the label', () => {
    expect(withCookieSettingsLink('<footer></footer>', 'A & <b>')).toContain('A &amp; &lt;b&gt;')
  })
})

describe('showsCookieSettingsLink', () => {
  it('is on for an imported footer unless Customize hides it', () => {
    expect(showsCookieSettingsLink('footer', {})).toBe(true)
    expect(showsCookieSettingsLink('footer', { _cookieSettingsLink: true })).toBe(true)
    expect(showsCookieSettingsLink('footer', { _cookieSettingsLink: false })).toBe(false)
    expect(showsCookieSettingsLink('newsletter', {})).toBe(false)
  })
})
