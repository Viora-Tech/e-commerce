import { describe, expect, it } from 'vitest'
import { DEFERRED_TYPE, deferThemeScripts } from './liquid-defer'
import { liquidShim } from './liquid-shim'

describe('deferThemeScripts', () => {
  it('parks deferred, async and module scripts and keeps their other attributes', () => {
    const html = [
      '<script src="/a.js" defer="defer" nonce="n1"></script>',
      '<script async src="/b.js"></script>',
      '<script type="module" nonce="n1">import "/c.js"; window.x = 1 < 2</script>',
      '<script type="module" src="/d.js" data-x="1"></script>',
    ].join('')
    expect(deferThemeScripts(html)).toBe(
      [
        `<script type="${DEFERRED_TYPE}" data-theme-src="/a.js" nonce="n1"></script>`,
        `<script type="${DEFERRED_TYPE}" data-theme-src="/b.js"></script>`,
        `<script type="${DEFERRED_TYPE}" data-theme-module nonce="n1">import "/c.js"; window.x = 1 < 2</script>`,
        `<script type="${DEFERRED_TYPE}" data-theme-src="/d.js" data-theme-module data-x="1"></script>`,
      ].join(''),
    )
  })

  it('leaves classic inline scripts, blocking scripts and data scripts where they are', () => {
    const html = [
      "<script>document.documentElement.classList.add('js')</script>",
      '<script src="/blocking.js"></script>',
      '<script type="application/json">{"a":1}</script>',
      '<script type="application/ld+json">{"@type":"Product"}</script>',
    ].join('')
    expect(deferThemeScripts(html)).toBe(html)
  })

  it('escapes attribute values it writes back', () => {
    expect(deferThemeScripts(`<script src='/a.js?x="1"&y=2' defer></script>`)).toBe(
      `<script type="${DEFERRED_TYPE}" data-theme-src="/a.js?x=&quot;1&quot;&amp;y=2"></script>`,
    )
  })
})

describe('the shim’s boot', () => {
  it('carries the boot and its stylesheet regular expression into the page script', () => {
    const shim = liquidShim({ askConsent: false })
    expect(shim).toContain('window.__commerceBootTheme')
    expect(shim).toContain('script[type="text/x-theme-deferred"]')
    // The regular expressions inside the shim survive the template string (escaped once).
    expect(shim).toContain("/this\\.media\\s*=\\s*'all'/")
  })
})
