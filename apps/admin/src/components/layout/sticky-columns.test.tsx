// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import StickyColumns from './sticky-columns'

/* jsdom has no layout: a column is 300px tall per card in it, the screen 800px. */
const CARD_PX = 300

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.querySelectorAll(':scope > [data-card]').length * CARD_PX
    },
  })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
})

afterAll(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight')
})

const cards = (name: string, n: number) =>
  Array.from({ length: n }, (_, i) => (
    <section key={`${name}-${i.toString()}`} data-card aria-label={`${name} ${i + 1}`} />
  ))

const columnOf = (label: string) => screen.getByLabelText(label).parentElement as HTMLElement

describe('StickyColumns', () => {
  it('keeps the side column in view when it is the shorter one', () => {
    render(<StickyColumns className="" main={cards('main', 4)} side={cards('side', 1)} />)
    expect(columnOf('side 1').hasAttribute('data-sticky')).toBe(true)
    expect(columnOf('main 1').hasAttribute('data-sticky')).toBe(false)
    expect(columnOf('side 1').style.getPropertyValue('--column-top')).toBe('1.5rem')
  })

  it('keeps the main column in view when the side column is taller (the customer page)', () => {
    render(<StickyColumns className="" main={cards('main', 1)} side={cards('side', 5)} />)
    expect(columnOf('main 1').hasAttribute('data-sticky')).toBe(true)
    expect(columnOf('main 1').className).toContain('lg:sticky')
    expect(columnOf('side 1').hasAttribute('data-sticky')).toBe(false)
    expect(columnOf('side 1').className).not.toContain('lg:sticky')
  })

  it('bottom-aligns a sticky column taller than the screen', () => {
    render(<StickyColumns className="" main={cards('main', 3)} side={cards('side', 5)} />)
    // 900px main on an 800px screen: 800 - 900 - 24 = -124px = -7.75rem.
    expect(columnOf('main 1').style.getPropertyValue('--column-top')).toBe('-7.75rem')
  })

  it('sticks nothing without a side column', () => {
    render(<StickyColumns className="" main={cards('main', 1)} />)
    expect(columnOf('main 1').hasAttribute('data-sticky')).toBe(false)
  })
})
