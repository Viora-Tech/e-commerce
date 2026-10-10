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
})
