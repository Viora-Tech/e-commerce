import { describe, expect, it } from 'vitest'
import { DEFERRED_TYPE, deferThemeScripts, PROMOTE_ATTR } from './liquid-defer'
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

describe('what our CSP and search engines would refuse', () => {
  it('drops the blocked inline onload of a print stylesheet and marks it for the shim', () => {
    const html = [
      `<link\n  rel="stylesheet"\n  media="print"\n  onload="this.media='all';this.onload=null"\n  href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP&display=swap"\n>`,
      '<noscript><link rel="stylesheet" href="/x.css"></noscript>',
    ].join('')
    expect(deferThemeScripts(html)).toBe(
      [
        `<link rel="stylesheet" media="print" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP&amp;display=swap" ${PROMOTE_ATTR}>`,
        '<noscript><link rel="stylesheet" href="/x.css"></noscript>',
      ].join(''),
    )
  })

  it('leaves other onload handlers and screen stylesheets alone', () => {
    const html = [
      `<link rel="stylesheet" media="all" onload="this.media='all'" href="/a.css">`,
      `<link rel="stylesheet" media="print" onload="track()" href="/b.css">`,
    ].join('')
    expect(deferThemeScripts(html)).toBe(html)
  })

  it('removes an empty JSON-LD script and keeps a filled one', () => {
    const html = [
      '<script nonce="n1" type="application/ld+json">\n    \n  </script>',
      '<script type="application/ld+json">{"@type":"Product"}</script>',
    ].join('')
    expect(deferThemeScripts(html)).toBe(
      '<script type="application/ld+json">{"@type":"Product"}</script>',
    )
  })
})

describe('the shim’s boot', () => {
  it('switches on the marked print stylesheets', () => {
    expect(liquidShim({ askConsent: false })).toContain(`[${PROMOTE_ATTR}]`)
  })

  it('carries the boot and its stylesheet regular expression into the page script', () => {
    const shim = liquidShim({ askConsent: false })
    expect(shim).toContain('window.__commerceBootTheme')
    expect(shim).toContain('script[type="text/x-theme-deferred"]')
    // The regular expressions inside the shim survive the template string (escaped once).
    expect(shim).toContain("/this\\.media\\s*=\\s*'all'/")
  })

  it('holds below-the-fold scripts and autoplay until their section nears the viewport', () => {
    const shim = liquidShim({ askConsent: false })
    expect(shim).toContain("hasAttribute('data-theme-near')")
    expect(shim).toContain('video[data-theme-autoplay]')
    expect(shim).toContain('IntersectionObserver')
    // Still one valid script.
    expect(() => new Function(shim)).not.toThrow()
  })
})
