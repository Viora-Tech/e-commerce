/** SOURCE OF TRUTH: app embeds tests. WHAT resolveAppEmbeds defaults, saved settings and dropped keys; appEmbedSources installed-only and namespace check. WHY the storefront and the editor must agree on what is on. No database. */
import { describe, expect, it } from 'vitest'
import { appEmbedSources, resolveAppEmbeds } from './app-embeds'

const chat = {
  type: 'inbox/Chat',
  label: 'Online store chat',
  fields: {},
  defaultProps: { greeting: 'Hi', position: 'right' },
  render: () => null,
}
const popup = { ...chat, type: 'forms/Popup', label: 'Pop-up', enabledByDefault: true }
const plugins = [
  { id: 'inbox', name: 'Inbox', storefront: { embeds: [chat] } },
  { id: 'forms', name: 'Forms', storefront: { embeds: [popup] } },
  { id: 'reviews', name: 'Reviews' },
]

describe('appEmbedSources', () => {
  it('lists only installed apps’ embeds, with their app', () => {
    const sources = appEmbedSources(plugins, new Set(['inbox', 'reviews']))
    expect(sources.map((s) => [s.appName, s.embed.type])).toEqual([['Inbox', 'inbox/Chat']])
  })

  it('refuses an embed that is not namespaced by its app', () => {
    const bad = [
      { id: 'inbox', name: 'Inbox', storefront: { embeds: [{ ...chat, type: 'Chat' }] } },
    ]
    expect(() => appEmbedSources(bad, new Set(['inbox']))).toThrow(/namespaced/)
  })
})

describe('resolveAppEmbeds', () => {
  const sources = appEmbedSources(plugins, new Set(['inbox', 'forms']))

  it('uses each embed’s default until the theme says otherwise', () => {
    const r = resolveAppEmbeds(sources, {})
    expect(r.map((e) => [e.embed.type, e.enabled])).toEqual([
      ['inbox/Chat', false],
      ['forms/Popup', true],
    ])
    expect(r[0]?.props).toEqual({ greeting: 'Hi', position: 'right' })
  })

  it('applies the theme’s switch and changed settings, dropping settings the embed lost', () => {
    const r = resolveAppEmbeds(sources, {
      'inbox/Chat': { enabled: true, settings: { greeting: 'Namaste', gone: 1 } },
      'forms/Popup': { enabled: false, settings: {} },
    })
    expect(r[0]).toMatchObject({ enabled: true, props: { greeting: 'Namaste', position: 'right' } })
    expect(r[0]?.props).not.toHaveProperty('gone')
    expect(r[1]?.enabled).toBe(false)
  })
})
