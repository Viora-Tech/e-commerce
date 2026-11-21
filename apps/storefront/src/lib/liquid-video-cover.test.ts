import { describe, expect, it } from 'vitest'
import { withoutVideoCovers } from './liquid-video-cover'

describe('withoutVideoCovers', () => {
  it('moves a background video cover out of sight and starts the first one loading', () => {
    const html = [
      '<video class="hero" muted loop playsinline preload="none" poster="/cover.jpg"><source src="/a.mp4"></video>',
      '<video muted preload="none" poster="/two.jpg"></video>',
    ].join('')
    expect(withoutVideoCovers(html)).toBe(
      [
        '<video class="hero" muted loop playsinline preload="auto" data-cover="/cover.jpg"><source src="/a.mp4"></video>',
        '<video muted preload="none" data-cover="/two.jpg"></video>',
      ].join(''),
    )
  })

  it('leaves players with controls, videos with no cover, and other markup alone', () => {
    const html =
      '<video controls poster="/p.jpg" preload="none"></video><video autoplay muted></video><img src="/x.png" poster="/no">'
    expect(withoutVideoCovers(html)).toBe(html)
  })

  it('keeps the preload a theme chose for a video that already loads', () => {
    expect(
      withoutVideoCovers("<video autoplay muted preload='metadata' poster='/c.jpg'></video>"),
    ).toBe("<video autoplay muted preload='metadata' data-cover='/c.jpg'></video>")
  })

  it('changes nothing more the second time (a cached section passes through it again)', () => {
    const once = withoutVideoCovers('<video muted preload="none" poster="/c.jpg"></video>')
    expect(withoutVideoCovers(once)).toBe(once)
  })
})
