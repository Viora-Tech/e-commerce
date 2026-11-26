import { DEFAULT_INBOX_WIDGET } from '@commerce/core/inbox'
import { describe, expect, it } from 'vitest'
import { nextTucked, PHONE_QUERY, SCROLL_SLOP, TOP_ZONE, TUCK_SELECTOR } from './launcher-tuck'
import { chatLauncherHtml, chatModuleSpec } from './plain-html/chat-launcher'
import { CHAT_MODULE } from './plain-html/chat-module'

describe('nextTucked', () => {
  it('tucks while the page scrolls down past the top', () => {
    expect(nextTucked(false, 400, 400 + SCROLL_SLOP + 1)).toBe(true)
  })

  it('comes back on a scroll up', () => {
    expect(nextTucked(true, 900, 900 - SCROLL_SLOP - 1)).toBe(false)
  })

  it('keeps its state through a small wobble', () => {
    expect(nextTucked(true, 900, 903)).toBe(true)
    expect(nextTucked(false, 900, 897)).toBe(false)
  })

  it('always shows near the top of the page', () => {
    expect(nextTucked(true, 0, TOP_ZONE)).toBe(false)
  })
})

describe('plain page chat button on a phone', () => {
  it('shrinks to 2.75rem and tucks with the same numbers as the React launcher', () => {
    const html = chatLauncherHtml({ ...DEFAULT_INBOX_WIDGET, horizontal: 'left' })
    expect(html).toContain(`@media ${PHONE_QUERY}{#wc-chat{height:2.75rem!important`)
    expect(html).toContain('left:0.75rem!important')
    expect(html).toContain('.is-tucked')
    const spec = chatModuleSpec(DEFAULT_INBOX_WIDGET, 'Waimers')
    expect(spec.config).toMatchObject({
      phone: PHONE_QUERY,
      tuck: TUCK_SELECTOR,
      slop: SCROLL_SLOP,
      top: TOP_ZONE,
    })
    expect(CHAT_MODULE).toContain("classList.toggle('is-tucked'")
  })
})
