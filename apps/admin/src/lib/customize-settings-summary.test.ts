import { defaultSectionSettings, sectionSettingsField } from '@commerce/blocks/puck'
import { describe, expect, it } from 'vitest'
import { settingsGroupSummary } from './customize-settings-summary'

type Group = { objectFields: Record<string, never> }

const field = sectionSettingsField([
  { label: 'Default', value: 'scheme-1' },
  { label: 'Night', value: 'scheme-2' },
]) as unknown as { objectFields: Record<string, Group> }

const groupFields = (key: string) => field.objectFields[key]?.objectFields ?? {}

describe('settingsGroupSummary', () => {
  const value = defaultSectionSettings({ padTop: 48, padBottom: 64 })

  it('summarises each shared settings group in plain words', () => {
    expect(settingsGroupSummary('layout', groupFields('layout'), value.layout)).toBe(
      'Normal · Center',
    )
    expect(settingsGroupSummary('spacing', groupFields('spacing'), value.spacing)).toBe('48 / 64')
    expect(settingsGroupSummary('style', groupFields('style'), value.style)).toBe('Default')
    expect(settingsGroupSummary('advanced', groupFields('advanced'), value.advanced)).toBe(
      'Everywhere',
    )
  })

  it('shows ranges, backgrounds and visibility changes', () => {
    const spacing = {
      ...value.spacing,
      paddingTop: { mobile: 24, tablet: 32, desktop: 48 },
    }
    expect(settingsGroupSummary('spacing', groupFields('spacing'), spacing)).toBe('24–48 / 64')
    const style = {
      ...value.style,
      colorScheme: 'scheme-2',
      backgroundImage: { url: 'x', alt: '' },
    }
    expect(settingsGroupSummary('style', groupFields('style'), style)).toBe('Night · Image')
    const advanced = { ...value.advanced, showOnDesktop: false, entranceAnimation: 'fade' }
    expect(settingsGroupSummary('advanced', groupFields('advanced'), advanced)).toBe(
      'Mobile only · Fade',
    )
  })
})
