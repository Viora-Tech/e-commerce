/** SOURCE OF TRUTH: checkout branding tests — defaults for older stores, what the schema refuses, readable text colours, the --ck-* properties, and the PIN code state fill-in */
import { describe, expect, it } from 'vitest'
import { CheckoutBrandingSchema, checkoutBrandingVars } from './branding'
import { stateForPincode } from './pincode-state'
import { parseCheckoutSettings } from './settings'

const defaultCheckoutBranding = CheckoutBrandingSchema.parse({})

describe('checkout branding', () => {
  it('gives stores saved before branding existed the neutral look', () => {
    const settings = parseCheckoutSettings({ checkout: { email: 'optional', gstin: true } })
    expect(settings.email).toBe('optional')
    expect(settings.branding).toEqual(defaultCheckoutBranding)
    expect(settings.branding.font).toBe('inter')
    expect(settings.branding.trustBadges).toBe(true)
  })

  it('keeps the rest of Settings → Checkout when the branding is broken', () => {
    const settings = parseCheckoutSettings({
      checkout: { email: 'optional', branding: { accent: 'red' } },
    })
    // One bad value fails the whole document, so the store falls back to defaults rather than half-parsing.
    expect(settings.branding.accent).toBe(defaultCheckoutBranding.accent)
  })

  it('rejects fonts outside the short list and colours that are not hex', () => {
    expect(CheckoutBrandingSchema.safeParse({ font: 'comic-sans' }).success).toBe(false)
    expect(CheckoutBrandingSchema.safeParse({ button: 'url(x)' }).success).toBe(false)
    expect(
      CheckoutBrandingSchema.safeParse({ logo: { mediaId: 'm', url: 'javascript:x' } }).success,
    ).toBe(false)
  })

  it('picks white text on dark colours and near-black on light ones', () => {
    const ink = (button: string) =>
      checkoutBrandingVars(CheckoutBrandingSchema.parse({ button }))['--ck-button-ink']
    expect(ink('#111827')).toBe('#FFFFFF')
    expect(ink('#2F5BEA')).toBe('#FFFFFF')
    expect(ink('#F5F5F2')).toBe('#111111')
    expect(ink('#FACC15')).toBe('#111111')
  })

  it('turns branding into the --ck-* properties the storefront and the preview share', () => {
    const vars = checkoutBrandingVars(
      CheckoutBrandingSchema.parse({
        button: '#FFFFFF',
        corners: 'round',
        font: 'manrope',
        summary: { kind: 'image', colour: '#1E1B4B', image: { mediaId: 'm', url: '/a"b.jpg' } },
      }),
    )
    expect(vars['--ck-button-ink']).toBe('#111111')
    expect(vars['--ck-radius-button']).toBe('62.5rem')
    expect(vars['--ck-font']).toContain('Manrope')
    expect(vars['--ck-summary-ink-light']).toBe('#FFFFFF')
    // The url is quoted and cannot close the declaration.
    expect(vars['--ck-summary-image']).toBe('url("/ab.jpg")')
  })

  it('shows no image until one is picked', () => {
    const vars = checkoutBrandingVars(
      CheckoutBrandingSchema.parse({ summary: { kind: 'image', image: null } }),
    )
    expect(vars['--ck-summary-image']).toBe('none')
  })
})

describe('stateForPincode', () => {
  it('fills the state when the prefix allows only one', () => {
    expect(stateForPincode('110001')).toBe('DL')
    expect(stateForPincode('560001')).toBe('KA')
  })

  it('leaves the pick to the shopper when the prefix spans states or is not a PIN code', () => {
    expect(stateForPincode('400001')).toBeNull()
    expect(stateForPincode('110')).toBeNull()
  })
})
