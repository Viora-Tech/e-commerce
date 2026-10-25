// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installCanvasInteraction, selectedControlsCss } from './customize-canvas-interaction'

// A canvas with two sections: the first selected, holding a carousel arrow and inline text.
const CANVAS = `
  <div data-puck-entry data-puck-preview-mode="edit">
    <div data-puck-component="a" role="button" aria-roledescription="draggable">
      <p class="copy">Words</p>
      <button class="next" type="button">Next</button>
      <span contenteditable="false" data-puck-overlay-portal="true">Heading</span>
      <a class="link" href="/products/x">Shop</a>
    </div>
    <div data-puck-component="b" role="button" aria-roledescription="draggable">
      <button class="other" type="button">Other</button>
    </div>
  </div>
`

let uninstall: () => void = () => {}
const reached = vi.fn()

beforeEach(() => {
  document.body.innerHTML = CANVAS
  for (const el of document.querySelectorAll('[data-puck-component]'))
    el.addEventListener('pointerdown', () => reached(el.getAttribute('data-puck-component')))
  uninstall = installCanvasInteraction(document, () => 'a')
})

afterEach(() => {
  uninstall()
  reached.mockReset()
})

const press = (selector: string) =>
  document.querySelector(selector)?.dispatchEvent(new Event('pointerdown', { bubbles: true }))

describe('installCanvasInteraction', () => {
  it('keeps a press on section content from reaching the drag sensor', () => {
    press('.copy')
    press('.other')
    expect(reached).not.toHaveBeenCalled()
  })

  it('lets a control in the selected section handle its own press', () => {
    press('.next')
    expect(reached).toHaveBeenCalledWith('a')
  })

  it('never starts a drag from inline text, so a drag there selects words', () => {
    press('[contenteditable]')
    expect(reached).not.toHaveBeenCalled()
  })

  it('keeps links from loading inside the canvas', () => {
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    document.querySelector('.link')?.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
  })

  it("hands a click on a section's invisible backdrop to the section under it", () => {
    const popup = document.querySelector('[data-puck-component="b"]') as Element
    popup.insertAdjacentHTML('beforeend', '<div class="scrim" style="opacity: 0"></div>')
    const scrim = document.querySelector('.scrim') as Element
    const words = document.querySelector('.copy') as Element
    document.elementsFromPoint = () => [scrim, popup, words]
    const clicked = vi.fn()
    for (const el of document.querySelectorAll('[data-puck-component]'))
      el.addEventListener('click', () => clicked(el.getAttribute('data-puck-component')))
    scrim.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(clicked).toHaveBeenCalledWith('a')
    expect(clicked).not.toHaveBeenCalledWith('b')
  })
})

describe('selectedControlsCss', () => {
  it('turns pointer events back on for the selected section only', () => {
    const css = selectedControlsCss('a')
    expect(css).toContain('[data-puck-component="a"]')
    expect(css).toContain('pointer-events: auto')
    expect(selectedControlsCss(null)).toBe('')
  })
})
