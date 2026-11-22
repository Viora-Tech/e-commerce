import { describe, expect, it } from 'vitest'
import { applyEmailBranding, EmailBrandingSchema } from './email-branding'

const theme = {
  logoUrl: 'https://shop.test/logo.png',
  logoDarkUrl: 'https://shop.test/logo-dark.png',
  logoWidth: 120,
  colour: '#111111',
  onColour: '#FFFFFF',
  shopUrl: 'https://shop.test',
}

describe('Email branding over the theme (owner, 22 Nov 2026)', () => {
  it('keeps the theme look when nothing is saved', () => {
    expect(applyEmailBranding(theme, null)).toEqual(theme)
  })

  it('takes the saved logo, size and colours, and drops the theme dark logo', () => {
    const out = applyEmailBranding(theme, {
      logoUrl: 'https://cdn.test/own.png',
      logoWidth: 180,
      colour: '#E86A2C',
    })
    expect(out).toMatchObject({
      logoUrl: 'https://cdn.test/own.png',
      logoDarkUrl: null,
      logoWidth: 180,
      colour: '#E86A2C',
      onColour: '#FFFFFF',
      shopUrl: 'https://shop.test',
    })
  })

  it('a null logo means no logo; colours must be #rrggbb', () => {
    expect(applyEmailBranding(theme, { logoUrl: null }).logoUrl).toBeNull()
    expect(EmailBrandingSchema.safeParse({ colour: 'orange' }).success).toBe(false)
    expect(EmailBrandingSchema.safeParse({ logoWidth: 400 }).success).toBe(false)
  })
})
