import { describe, expect, it } from 'vitest'
import {
  defaultSectionSettings,
  migrateSectionSettings,
  sectionVisibilityClassName,
  shouldAnimateEntrance,
} from '../src/section-settings'

describe('defaultSectionSettings', () => {
  it("reproduces today's output for a section with no legacy props", () => {
    const settings = defaultSectionSettings()
    expect(settings.style.colorScheme).toBe('scheme-1')
    expect(settings.spacing.paddingTop).toEqual({ mobile: 48, tablet: 48, desktop: 48 })
    expect(settings.spacing.paddingBottom).toEqual({ mobile: 48, tablet: 48, desktop: 48 })
    expect(settings.layout).toEqual({ contentWidth: 'normal', alignment: 'center', gap: 0 })
    expect(settings.advanced).toEqual({
      showOnMobile: true,
      showOnDesktop: true,
      entranceAnimation: 'none',
      anchorId: '',
      customCss: '',
    })
  })

  it("seeds padding/scheme from the legacy defaults a section passes in (e.g. ImageBanner's 0/0)", () => {
    const settings = defaultSectionSettings({ scheme: 'scheme-5', padTop: 0, padBottom: 0 })
    expect(settings.style.colorScheme).toBe('scheme-5')
    expect(settings.spacing.paddingTop).toEqual({ mobile: 0, tablet: 0, desktop: 0 })
    expect(settings.spacing.paddingBottom).toEqual({ mobile: 0, tablet: 0, desktop: 0 })
  })
})

describe('migrateSectionSettings — old props to new structure', () => {
  it('maps a legacy flat {scheme, padTop, padBottom} doc onto the new nested settings', () => {
    const migrated = migrateSectionSettings({ scheme: 'scheme-3', padTop: 64, padBottom: 32 })
    expect(migrated.style.colorScheme).toBe('scheme-3')
    expect(migrated.spacing.paddingTop).toEqual({ mobile: 64, tablet: 64, desktop: 64 })
    expect(migrated.spacing.paddingBottom).toEqual({ mobile: 32, tablet: 32, desktop: 32 })
    // Every breakpoint gets the same value the section rendered at everywhere before —
    // no new responsive difference is invented by migrating.
    expect(migrated.spacing.paddingTop.mobile).toBe(migrated.spacing.paddingTop.desktop)
  })

  it('is a no-op (structurally) when props already carry a full settings object', () => {
    const already = defaultSectionSettings({ scheme: 'scheme-2', padTop: 10, padBottom: 20 })
    const migrated = migrateSectionSettings({ settings: already })
    expect(migrated).toEqual(already)
  })

  it('fills in missing groups on a settings object from an older release', () => {
    const partial = { style: { colorScheme: 'scheme-4' } }
    const migrated = migrateSectionSettings({ settings: partial })
    expect(migrated.style.colorScheme).toBe('scheme-4')
    expect(migrated.advanced.entranceAnimation).toBe('none')
    expect(migrated.layout.contentWidth).toBe('normal')
  })

  it('never throws on malformed input and falls back to defaults', () => {
    expect(() => migrateSectionSettings({ settings: 'nonsense' as never })).not.toThrow()
    expect(() => migrateSectionSettings({})).not.toThrow()
    expect(migrateSectionSettings({ settings: null as never })).toEqual(defaultSectionSettings())
  })

  it('a real settings object wins over stale legacy flat props left on the same object', () => {
    const settings = defaultSectionSettings({ scheme: 'scheme-2', padTop: 99, padBottom: 99 })
    const migrated = migrateSectionSettings({
      scheme: 'scheme-1',
      padTop: 1,
      padBottom: 1,
      settings,
    })
    expect(migrated.style.colorScheme).toBe('scheme-2')
    expect(migrated.spacing.paddingTop.desktop).toBe(99)
  })
})

describe('sectionVisibilityClassName — hidden-on-mobile/desktop classes', () => {
  it('adds no classes when shown everywhere', () => {
    expect(
      sectionVisibilityClassName({
        showOnMobile: true,
        showOnDesktop: true,
        entranceAnimation: 'none',
        anchorId: '',
        customCss: '',
      }),
    ).toBe('')
  })

  it('hides on mobile with max-md:hidden', () => {
    expect(
      sectionVisibilityClassName({
        showOnMobile: false,
        showOnDesktop: true,
        entranceAnimation: 'none',
        anchorId: '',
        customCss: '',
      }),
    ).toBe('max-md:hidden')
  })

  it('hides on desktop with md:hidden', () => {
    expect(
      sectionVisibilityClassName({
        showOnMobile: true,
        showOnDesktop: false,
        entranceAnimation: 'none',
        anchorId: '',
        customCss: '',
      }),
    ).toBe('md:hidden')
  })
})

describe('shouldAnimateEntrance — reduced motion disables animation', () => {
  it('animates when an animation is set and motion is not reduced', () => {
    expect(shouldAnimateEntrance('fade', false)).toBe(true)
  })

  it('never animates under reduced motion, regardless of which animation is set', () => {
    expect(shouldAnimateEntrance('fade', true)).toBe(false)
    expect(shouldAnimateEntrance('slide-up', true)).toBe(false)
    expect(shouldAnimateEntrance('zoom', true)).toBe(false)
  })

  it('never animates when the animation is "none", even without reduced motion', () => {
    expect(shouldAnimateEntrance('none', false)).toBe(false)
  })
})

describe('migrateSectionSettings — unsafe stored values', () => {
  it('drops a background colour that is not plainly a colour', () => {
    const migrated = migrateSectionSettings({
      settings: {
        style: { backgroundColor: 'red;position:fixed;inset:0;background:url(https://evil/b)' },
      },
    })
    expect(migrated.style.backgroundColor).toBe('')
    expect(
      migrateSectionSettings({ settings: { style: { backgroundColor: '#ff0088' } } }).style
        .backgroundColor,
    ).toBe('#ff0088')
    expect(
      migrateSectionSettings({ settings: { style: { backgroundColor: 'red' } } }).style
        .backgroundColor,
    ).toBe('red')
  })

  it('keeps only slug anchor ids', () => {
    const anchor = (anchorId: unknown) =>
      migrateSectionSettings({ settings: { advanced: { anchorId } } }).advanced.anchorId
    expect(anchor('faq-2')).toBe('faq-2')
    expect(anchor('x" onclick="y')).toBe('')
    expect(anchor('1abc')).toBe('')
    expect(anchor(42)).toBe('')
  })

  it('falls back to the default scheme for anything that is not a scheme id', () => {
    const scheme = (colorScheme: unknown) =>
      migrateSectionSettings({ settings: { style: { colorScheme } } }).style.colorScheme
    expect(scheme('scheme-3')).toBe('scheme-3')
    expect(scheme('scheme-1 fixed inset-0 z-50')).toBe('scheme-1')
    expect(scheme(7)).toBe('scheme-1')
    expect(migrateSectionSettings({ scheme: 'x fixed' }).style.colorScheme).toBe('scheme-1')
  })
})
