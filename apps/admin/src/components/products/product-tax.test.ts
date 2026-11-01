/** SOURCE OF TRUTH: product-level HSN and GST rate (#63): lifting variant values, per-variant override, the "No HS code" check */
import { describe, expect, it } from 'vitest'
import { emptyForm, emptyVariant, toWrite, type VariantRow } from './form-state'
import { liftTax, liftTaxValue, missingHsCode, variantTax } from './product-tax'

const row = (hsCode: string, gstRate = ''): Pick<VariantRow, 'hsCode' | 'gstRate'> => ({
  hsCode,
  gstRate,
})

describe('liftTaxValue', () => {
  it('keeps a saved product value and opens per-variant only when a variant differs', () => {
    expect(liftTaxValue('8471', ['', '8471'])).toEqual({ value: '8471', perVariant: false })
    expect(liftTaxValue('8471', ['8472', ''])).toEqual({ value: '8471', perVariant: true })
  })

  it('lifts a value every variant shares', () => {
    expect(liftTaxValue('', ['8471', '8471', ' 8471 '])).toEqual({
      value: '8471',
      perVariant: false,
    })
    expect(liftTaxValue('', ['', ''])).toEqual({ value: '', perVariant: false })
  })

  it('never lifts a value some variants lack, so a blank GST rate keeps the store rate', () => {
    expect(liftTaxValue('', ['18', ''])).toEqual({ value: '', perVariant: true })
    expect(liftTaxValue('', ['8471', '8473'])).toEqual({ value: '', perVariant: true })
  })
})

describe('liftTax', () => {
  it('turns per-variant on when either field differs', () => {
    expect(
      liftTax({ hsCode: null, gstRatePercent: null }, [row('8471', '18'), row('8471', '12')]),
    ).toEqual({ hsCode: '8471', gstRate: '', perVariant: true })
    expect(liftTax({ hsCode: '8471', gstRatePercent: 18 }, [row(''), row('')])).toEqual({
      hsCode: '8471',
      gstRate: '18',
      perVariant: false,
    })
  })
})

describe('variantTax and missingHsCode', () => {
  const tax = { hsCode: '8471', gstRate: '18', perVariant: true }

  it('uses the variant value when per-variant, else the product value', () => {
    expect(variantTax(tax, row('8473', ''))).toEqual({ hsCode: '8473', gstRate: '18' })
    expect(variantTax({ ...tax, perVariant: false }, row('8473', '5'))).toEqual({
      hsCode: '8471',
      gstRate: '18',
    })
  })

  it('flags a variant that would print no HSN', () => {
    expect(missingHsCode(tax, [row(''), row('8473')])).toBe(false)
    expect(missingHsCode({ ...tax, hsCode: '' }, [row(''), row('8473')])).toBe(true)
    expect(missingHsCode({ hsCode: '', gstRate: '', perVariant: false }, [row('8473')])).toBe(true)
  })
})

describe('toWrite with product tax', () => {
  const variants = [{ ...emptyVariant(['S']), hsCode: '8473', gstRate: '5' }, emptyVariant(['M'])]

  it('sends the product value and clears variant values unless per-variant', () => {
    const write = toWrite({
      ...emptyForm(),
      title: 'Mouse',
      tax: { hsCode: '8471', gstRate: '18', perVariant: false },
      variants,
    })
    expect(write).toMatchObject({ hsCode: '8471', gstRatePercent: 18 })
    expect(write.variants.map((v) => [v.hsCode, v.gstRatePercent])).toEqual([
      [null, null],
      [null, null],
    ])
  })

  it('keeps variant overrides when per-variant is on', () => {
    const write = toWrite({
      ...emptyForm(),
      title: 'Mouse',
      tax: { hsCode: '8471', gstRate: '', perVariant: true },
      variants,
    })
    expect(write).toMatchObject({ hsCode: '8471', gstRatePercent: null })
    expect(write.variants.map((v) => [v.hsCode, v.gstRatePercent])).toEqual([
      ['8473', 5],
      [null, null],
    ])
  })
})
