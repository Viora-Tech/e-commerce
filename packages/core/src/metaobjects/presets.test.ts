import { describe, expect, it } from 'vitest'
import { METAOBJECT_PRESETS, PRESET_KEYS, PresetKeySchema, presetDefinition } from './presets'
import { MetaobjectDefinitionWriteSchema } from './schemas'
import { definitionProblems } from './validate'

describe('METAOBJECT_PRESETS', () => {
  it('offers the six ready-made content types in card order', () => {
    expect(PRESET_KEYS).toEqual([
      'size_guide',
      'faq',
      'team_member',
      'store_location',
      'testimonial',
      'lookbook',
    ])
  })

  it('builds a definition that passes the same checks as one made by hand', () => {
    for (const preset of PRESET_KEYS) {
      const write = presetDefinition({ preset })
      expect(MetaobjectDefinitionWriteSchema.parse(write)).toEqual(write)
      expect(definitionProblems(write.fields, write.displayNameKey)).toEqual([])
      expect(write.type).toBeUndefined()
      expect(write.fields.some((f) => f.required && f.key === write.displayNameKey)).toBe(true)
    }
  })

  it('takes the merchant name over the preset name, and hands out copies', () => {
    expect(presetDefinition({ preset: 'faq', name: '  Shipping questions ' }).name).toBe(
      'Shipping questions',
    )
    expect(presetDefinition({ preset: 'faq', name: '   ' }).name).toBe('FAQ')
    const a = presetDefinition({ preset: 'size_guide' })
    const [first] = a.fields
    if (first) first.name = 'Changed'
    expect(METAOBJECT_PRESETS.size_guide.fields[0]?.name).toBe('Title')
  })

  it('refuses keys that are not presets', () => {
    expect(PresetKeySchema.safeParse('blog').success).toBe(false)
  })
})
