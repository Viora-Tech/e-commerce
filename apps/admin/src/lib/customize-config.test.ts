import { defaultTemplate } from '@commerce/core/theme'
import { describe, expect, it } from 'vitest'
import { createCustomizeConfig } from './customize-config'

// The editor builds this once, from the installed apps the page read on the server,
// because `<Puck>` only reads `config` at mount (a later config would need a remount).
describe('createCustomizeConfig', () => {
  it('lists an installed app’s blocks on the Apps tab from the first build', () => {
    const config = createCustomizeConfig(new Set(['back-in-stock']))
    const apps = config.categories?.apps?.components ?? []
    expect(apps.some((type) => String(type).startsWith('back-in-stock/'))).toBe(true)
  })

  it('leaves the Apps tab empty when nothing is installed', () => {
    expect(createCustomizeConfig().categories?.apps?.components ?? []).toEqual([])
  })

  it('gives every richtext field, nested ones included, the canvas link menu', () => {
    type Field = { type?: string; renderInlineMenu?: unknown; arrayFields?: Record<string, Field> }
    const fields = (type: string) =>
      createCustomizeConfig().components[type]?.fields as unknown as Record<string, Field>
    expect(fields('RichText').body?.renderInlineMenu).toBeTypeOf('function')
    expect(fields('Multicolumn').columns?.arrayFields?.text?.renderInlineMenu).toBeTypeOf(
      'function',
    )
    expect(fields('RichText').heading?.renderInlineMenu).toBeUndefined()
  })

  it('offers the Zero Drift group only to a store with the pack, after our own groups', () => {
    const off = Object.keys(createCustomizeConfig().categories ?? {})
    expect(off).not.toContain('zeroDrift')
    expect(off[0]).toBe('banners')
    const on = Object.keys(createCustomizeConfig(new Set(), ['zero-drift']).categories ?? {})
    expect(on).toContain('zeroDrift')
    expect(on.indexOf('zeroDrift')).toBeGreaterThan(on.indexOf('more'))
    // Registered either way, so a page that already uses one keeps rendering and editing.
    expect(createCustomizeConfig().components.DiscordCta).toBeTruthy()
  })

  it("starts a new store's header, home and footer without Waimers copy", () => {
    // As the storefront draws a template: each section's stored props over its defaults.
    const { components } = createCustomizeConfig()
    for (const key of ['header', 'home', 'footer'] as const) {
      const drawn = defaultTemplate(key).content.map((s) => ({
        ...(components[s.type]?.defaultProps as Record<string, unknown> | undefined),
        ...s.props,
      }))
      expect(JSON.stringify(drawn), key).not.toMatch(
        /waimers|glasspad|glass-mousepad|discord|lofree|find-your-match|sonipat/i,
      )
    }
  })
})
