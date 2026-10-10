import { sectionSettingsField } from '@commerce/blocks/puck'
import { describe, expect, it } from 'vitest'
import { type FieldLike, isSectionSettingsField } from './customize-field-shape'

const schemes = [{ label: 'Default', value: 'scheme-1' }]

describe('isSectionSettingsField', () => {
  it('knows every kind of the shared Section settings, so each gets the settings panel', () => {
    for (const kind of ['section', 'bleed', 'flow'] as const) {
      const field = sectionSettingsField(schemes, kind) as unknown as FieldLike
      expect(isSectionSettingsField(field, 'settings'), kind).toBe(true)
    }
  })

  it('leaves other object fields alone', () => {
    const field = { type: 'object', objectFields: { url: {}, alt: {} } } as unknown as FieldLike
    expect(isSectionSettingsField(field, 'settings')).toBe(false)
    const settings = sectionSettingsField(schemes) as unknown as FieldLike
    expect(isSectionSettingsField(settings, 'image')).toBe(false)
  })
})
