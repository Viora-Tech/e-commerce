// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { coverOf, keeper, stillPosters, withinTime } from './capture-theme-thumbnail'

/** A body like an imported theme's hero: a slide with a poster video, one without a poster. */
function hero(): HTMLElement {
  document.body.innerHTML = `
    <section class="hero">
      <div class="slide one"><video preload="none" muted poster="https://cdn.test/poster.jpg" style="position:absolute;width:100%"><source src="https://cdn.test/a.mp4"></video><h2>Drop</h2></div>
      <div class="slide two"><video preload="none" muted><source src="https://cdn.test/b.mp4"></video></div>
    </section>`
  return document.body
}

describe('keeper', () => {
  it('leaves every video out of the clone, however high on the page', () => {
    const body = hero()
    const keep = keeper(10_000)
    for (const video of body.querySelectorAll('video')) expect(keep(video)).toBe(false)
    expect(keep(body.querySelector('h2') as Element)).toBe(true)
    expect(keep(document.createTextNode('x'))).toBe(true)
  })

  it('still leaves out editor chrome and marked nodes', () => {
    const el = document.createElement('div')
    el.className = 'canvas-insert-line'
    expect(keeper(10_000)(el)).toBe(false)
    const skip = document.createElement('div')
    skip.setAttribute('data-screenshot-skip', '')
    expect(keeper(10_000)(skip)).toBe(false)
  })
})

describe('stillPosters', () => {
  it("puts each video's poster where the video was in the clone, then clears the live page", () => {
    const body = hero()
    const posters = stillPosters(body)
    const one = body.querySelector('.one') as Element
    expect(one.getAttribute('data-screenshot-posters')).toBe('0')
    // A video with no poster marks nothing: its box stays as the page paints it.
    expect(body.querySelector('.two')?.hasAttribute('data-screenshot-posters')).toBe(false)

    // The clone modern-screenshot makes: the same tree, minus the videos (keeper).
    const clone = body.cloneNode(true) as HTMLElement
    for (const v of clone.querySelectorAll('video')) v.remove()
    posters.apply(clone)
    const img = clone.querySelector('.one img') as HTMLImageElement
    expect(img.src).toBe('https://cdn.test/poster.jpg')
    expect(img.getAttribute('style')).toContain('position:absolute')
    expect(clone.querySelector('[data-screenshot-posters]')).toBeNull()

    posters.restore()
    expect(body.querySelector('[data-screenshot-posters]')).toBeNull()
  })

  it('reads the cover the live storefront moved to data-cover, or a lazy data-poster', () => {
    const video = (attrs: string) => {
      document.body.innerHTML = `<video ${attrs}></video>`
      return document.body.querySelector('video') as HTMLVideoElement
    }
    expect(coverOf(video('poster="https://cdn.test/p.jpg"'))).toBe('https://cdn.test/p.jpg')
    expect(coverOf(video('data-cover="https://cdn.test/c.jpg"'))).toBe('https://cdn.test/c.jpg')
    expect(coverOf(video('data-poster="https://cdn.test/d.jpg"'))).toBe('https://cdn.test/d.jpg')
    expect(coverOf(video('muted'))).toBe('')
  })

  it('ignores a clone that is not an element', () => {
    const posters = stillPosters(hero())
    expect(() => posters.apply(document.createTextNode('x'))).not.toThrow()
    posters.restore()
  })
})

describe('withinTime', () => {
  it('passes a result through and gives up on work that never settles', async () => {
    await expect(withinTime(Promise.resolve('ok'), 50)).resolves.toBe('ok')
    await expect(withinTime(new Promise(() => undefined), 20)).rejects.toThrow('no picture')
  })
})
