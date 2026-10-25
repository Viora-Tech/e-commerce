import { describe, expect, it } from 'vitest'
import { DEFERRED_TYPE } from './liquid-defer'
import { belowTheFold } from './liquid-fold'

describe('belowTheFold', () => {
  it('makes every image and iframe lazy and drops a high fetch priority', () => {
    const html = [
      '<img src="/a.png" loading="eager" fetchpriority="high" alt="a > b">',
      '<img\n  src="/b.png"\n  width="60"\n/>',
      "<IMG src='/c.png' Loading='lazy'>",
      '<iframe src="https://example.com/embed"></iframe>',
    ].join('')
    expect(belowTheFold(html)).toBe(
      [
        '<img src="/a.png" alt="a > b" loading="lazy">',
        '<img src="/b.png" width="60" loading="lazy">',
        `<IMG src='/c.png' loading="lazy">`,
        '<iframe src="https://example.com/embed" loading="lazy"></iframe>',
      ].join(''),
    )
  })

  it('leaves attributes that only look alike', () => {
    const html = '<img src="/a.png" data-loading="eager" alt="fast loading=eager">'
    expect(belowTheFold(html)).toBe(
      '<img src="/a.png" data-loading="eager" alt="fast loading=eager" loading="lazy">',
    )
  })

  it('stops videos fetching up front and hands autoplay to the shim', () => {
    const html = [
      '<video src="/a.mp4" muted playsinline autoplay loop poster="/a.jpg"></video>',
      '<video src="/b.mp4" preload="auto" controls></video>',
    ].join('')
    expect(belowTheFold(html)).toBe(
      [
        '<video src="/a.mp4" muted playsinline loop poster="/a.jpg" preload="none" data-theme-autoplay></video>',
        '<video src="/b.mp4" controls preload="none"></video>',
      ].join(''),
    )
  })

  it('marks parked scripts to run near the viewport and leaves every other script alone', () => {
    const parked = `<script type="${DEFERRED_TYPE}" data-theme-src="/x.js" nonce="n"></script>`
    const inline = '<script>window.a = 1 > 0</script>'
    const data = '<script type="application/json">{"a":1}</script>'
    expect(belowTheFold(parked + inline + data)).toBe(
      `<script type="${DEFERRED_TYPE}" data-theme-src="/x.js" nonce="n" data-theme-near></script>${inline}${data}`,
    )
    // Applying it twice changes nothing more.
    expect(belowTheFold(belowTheFold(parked))).toBe(belowTheFold(parked))
  })

  it('does not touch text or other elements', () => {
    const html =
      '<p class="x">images <b>load</b> here</p><picture><source srcset="/a.webp"></picture>'
    expect(belowTheFold(html)).toBe(html)
  })
})
