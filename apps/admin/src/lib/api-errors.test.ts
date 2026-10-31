import { describe, expect, it } from 'vitest'
import { validationContent } from '@/data/common'
import {
  describeValidation,
  fieldErrorsOf,
  validationIssuesOf,
  withReadableValidation,
} from './api-errors'

describe('validationIssuesOf', () => {
  it('reads issues, joins the path and keeps the limit of too-big ones', () => {
    const err = {
      data: {
        issues: [
          { message: 'Too big', code: 'too_big', maximum: 70, path: ['seoTitle'] },
          { message: 'Invalid', code: 'invalid_format', path: ['variants', 0, { key: 'sku' }] },
        ],
      },
    }
    expect(validationIssuesOf(err)).toEqual([
      { path: 'seoTitle', message: 'Too big', max: 70 },
      { path: 'variants.0.sku', message: 'Invalid' },
    ])
  })

  it('is empty for other errors', () => {
    expect(validationIssuesOf(new Error('x'))).toEqual([])
    expect(validationIssuesOf(null)).toEqual([])
  })
})

describe('describeValidation (#804)', () => {
  const err = (issues: unknown[]) =>
    Object.assign(new Error('Input validation failed'), { data: { issues } })

  it('names the collection that is not an id instead of "Input validation failed"', () => {
    const e = err([
      {
        code: 'invalid_format',
        format: 'uuid',
        path: ['collectionIds', 1],
        message: 'Invalid UUID',
      },
    ])
    expect(describeValidation(e, validationContent)).toBe('Collections (item 2): not a valid ID')
    expect((withReadableValidation(e, validationContent) as Error).message).toBe(
      'Collections (item 2): not a valid ID',
    )
  })

  it('spells out nested and unknown fields, limits and missing values', () => {
    const e = err([
      { code: 'too_big', origin: 'string', maximum: 70, path: ['variants', 0, 'sku'] },
      { code: 'invalid_type', expected: 'string', path: ['title'], message: 'x' },
      { code: 'too_small', origin: 'number', minimum: 0, path: ['weightUnitGrams'] },
      { code: 'custom', path: [], message: 'Pick one' },
    ])
    expect(describeValidation(e, validationContent)).toBe(
      'Variant 1 › SKU: too long, keep it to 70 characters or fewer. Title: required. ' +
        'Weight unit grams: must be at least 0. 1 more to fix',
    )
  })

  it('names list entries and leaves out wrappers the member never sees (#101)', () => {
    const e = err([
      { code: 'too_small', origin: 'string', minimum: 1, path: ['boxPresets', 0, 'name'] },
      { code: 'invalid_format', format: 'regex', path: ['policy', 'originPincode'] },
    ])
    expect(describeValidation(e, validationContent)).toBe(
      'Package 1 › Name: required. PIN code to ship from: not in the right format',
    )
  })

  it('leaves other errors alone', () => {
    const e = new Error('Not found')
    expect(describeValidation(e, validationContent)).toBeNull()
    expect((withReadableValidation(e, validationContent) as Error).message).toBe('Not found')
  })
})

describe('fieldErrorsOf', () => {
  it('defaults to no errors', () => {
    expect(fieldErrorsOf(undefined)).toEqual({})
  })
})
