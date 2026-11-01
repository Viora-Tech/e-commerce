/** SOURCE OF TRUTH: saved package tests (audit #162) — WHAT: package kinds in the shipping settings / WHY: guard Settings › Shipping › Packages */
import { describe, expect, it } from 'vitest'
import { parseShippingSettings } from './settings'

const box = {
  id: 'b1',
  name: 'Small box',
  lengthCm: 20,
  widthCm: 15,
  heightCm: 10,
  weightGrams: 200,
}

describe('saved packages (audit #162)', () => {
  it('reads a box saved before package types as a box', () => {
    const [saved] = parseShippingSettings({ boxPresets: [box] }).boxPresets
    expect(saved?.kind).toBe('box')
  })

  it('keeps envelopes and soft packages, and refuses other types', () => {
    const settings = parseShippingSettings({
      boxPresets: [
        { ...box, kind: 'envelope', heightCm: 1 },
        { ...box, id: 'b2', kind: 'soft_package' },
      ],
    })
    expect(settings.boxPresets.map((b) => b.kind)).toEqual(['envelope', 'soft_package'])
    expect(parseShippingSettings({ boxPresets: [{ ...box, kind: 'crate' }] }).boxPresets).toEqual(
      [],
    )
  })
})
