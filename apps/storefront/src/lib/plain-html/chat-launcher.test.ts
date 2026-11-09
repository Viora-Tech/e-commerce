import { DEFAULT_INBOX_WIDGET } from '@commerce/core/inbox'
import { describe, expect, it } from 'vitest'
import { CHAT_FRAME_PATH } from '../inbox-frame'
import { routeForStore } from '../routing'
import { chatLauncherHtml, chatModuleSpec } from './chat-launcher'
import { CHAT_MODULE } from './chat-module'
import { islandScript } from './islands'

describe('plain page chat button', () => {
  it('draws the round button with its icon, chevron and badge in the corner the merchant picked', () => {
    const html = chatLauncherHtml({
      ...DEFAULT_INBOX_WIDGET,
      horizontal: 'left',
      vertical: 'higher',
    })
    expect(html).toContain('<button type="button" id="wc-chat" data-chat-root')
    expect(html).toContain('wc-chat-chevron')
    expect(html).toContain('class="wc-chat-badge" hidden')
    expect(html).toContain('left:1rem!important')
    expect(html).toContain('5.5rem + env(safe-area-inset-bottom)')
  })

  it('draws a pill with the label, escaped, and keeps merchant colours', () => {
    const html = chatLauncherHtml({
      ...DEFAULT_INBOX_WIDGET,
      activatorLabel: 'Ask <us>',
      background: '#6C3BAA',
      textColour: '#FFFFFF',
    })
    expect(html).toContain('<span>Ask &lt;us&gt;</span>')
    expect(html).toContain('background:#6C3BAA!important')
    expect(html).not.toContain('<us>')
  })

  it('loads the chat module from the inline island and opens the frame path', () => {
    const spec = chatModuleSpec(DEFAULT_INBOX_WIDGET, 'Waimers')
    expect(spec.src).toMatch(/^\/api\/islands\/chat\.js\?v=/)
    expect(spec.config.frame).toBe(CHAT_FRAME_PATH)
    const code = islandScript({
      bannerVersion: 1,
      tracking: { ga4: '', gtm: '', metaPixel: '', googleAds: '' },
      umami: null,
      chat: spec,
    })
    expect(code).toContain('/api/islands/chat.js?v=')
    expect(() => new Function(code)).not.toThrow()
    expect(() => new Function(CHAT_MODULE)).not.toThrow()
  })

  it('routes the frame path to the frame page, and refuses the internal one', () => {
    expect(routeForStore('s1', CHAT_FRAME_PATH)).toEqual({ kind: 'rewrite', path: '/-c/s1' })
    expect(routeForStore('s1', '/-c/s1')).toEqual({ kind: 'forbidden' })
    expect(routeForStore('s1', '/inbox/photo')).toEqual({
      kind: 'rewrite',
      path: '/-s/s1/inbox/photo',
    })
  })
})
