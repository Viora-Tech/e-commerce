import { describe, expect, it } from 'vitest'
import { fieldErrorsOf, validationIssuesOf } from './api-errors'

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

describe('fieldErrorsOf', () => {
  it('defaults to no errors', () => {
    expect(fieldErrorsOf(undefined)).toEqual({})
  })
})
