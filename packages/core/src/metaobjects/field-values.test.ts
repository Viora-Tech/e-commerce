/** SOURCE OF TRUTH: CMS PR2 field type tests — colour, date and time, money, choice, link, rating, measurement, references, groups, and the field-change lock */
import { describe, expect, it } from 'vitest'
import { fieldChangeProblems } from './field-changes'
import { measurementText, moneyText, normaliseHex, ratingText } from './field-values'
import { type FieldDefinition, MetaobjectDefinitionWriteSchema } from './schemas'
import {
  collectReferences,
  definitionProblems,
  type FieldRule,
  isEmptyValue,
  ruleProblems,
  validateFieldValue,
} from './validate'

const ID = '0199a0c0-0000-7000-8000-000000000001'
const ID2 = '0199a0c0-0000-7000-8000-000000000002'

const rule = (type: FieldRule['type'], extra: Partial<FieldRule> = {}): FieldRule => ({
  name: 'Field',
  type,
  list: false,
  ...extra,
})

const ok = (r: ReturnType<typeof validateFieldValue>) => (r.ok ? r.value : `ERR ${r.error}`)

const sizes: FieldRule = rule('group', {
  name: 'Sizes',
  validations: {
    subfields: [
      { key: 'size', name: 'Size', type: 'single_line_text', required: true },
      {
        key: 'chest',
        name: 'Chest',
        type: 'measurement',
        required: false,
        validations: { measure: 'length' },
      },
      { key: 'photo', name: 'Photo', type: 'file', required: false },
    ],
  },
})

describe('colour', () => {
  it('keeps hex colours, lower case, and widens the short form', () => {
    expect(ok(validateFieldValue(rule('color'), '#1A2B3C'))).toBe('#1a2b3c')
    expect(ok(validateFieldValue(rule('color'), '#fa0'))).toBe('#ffaa00')
    expect(validateFieldValue(rule('color'), 'red').ok).toBe(false)
    expect(validateFieldValue(rule('color'), '#12345').ok).toBe(false)
    expect(normaliseHex(' #ABCDEF ')).toBe('#abcdef')
  })
})

describe('date and time', () => {
  it('stores the instant in UTC and refuses times without a zone', () => {
    expect(ok(validateFieldValue(rule('date_time'), '2026-10-02T10:00:00+05:30'))).toBe(
      '2026-10-02T04:30:00.000Z',
    )
    expect(ok(validateFieldValue(rule('date_time'), '2026-10-02T04:30Z'))).toBe(
      '2026-10-02T04:30:00.000Z',
    )
    expect(validateFieldValue(rule('date_time'), '2026-10-02T10:00').ok).toBe(false)
    expect(validateFieldValue(rule('date_time'), '2026-13-02T10:00Z').ok).toBe(false)
  })
})

describe('money', () => {
  it('stores whole paise with the field currency', () => {
    expect(ok(validateFieldValue(rule('money'), { amount: 49900, currency: 'INR' }))).toEqual({
      amount: 49900,
      currency: 'INR',
    })
    expect(ok(validateFieldValue(rule('money'), 1500))).toEqual({ amount: 1500, currency: 'INR' })
    const usd = rule('money', { validations: { currency: 'USD' } })
    expect(ok(validateFieldValue(usd, { amount: 999 }))).toEqual({ amount: 999, currency: 'USD' })
    expect(validateFieldValue(usd, { amount: 999, currency: 'INR' })).toEqual({
      ok: false,
      error: 'Field must be in USD',
    })
    expect(validateFieldValue(rule('money'), { amount: 4.5 }).ok).toBe(false)
    expect(validateFieldValue(rule('money'), { amount: -1 }).ok).toBe(false)
    expect(moneyText({ amount: 49900, currency: 'INR' })).toBe('₹499')
    expect(moneyText(12345)).toBe('₹123.45')
  })
})

describe('choice', () => {
  const sizesChoice = rule('choice', { validations: { choices: ['S', 'M', 'L'] } })
  it('takes only a listed choice, and several when it is a list', () => {
    expect(ok(validateFieldValue(sizesChoice, 'M'))).toBe('M')
    expect(validateFieldValue(sizesChoice, 'XL')).toEqual({
      ok: false,
      error: 'Field must be picked from the choices',
    })
    expect(ok(validateFieldValue({ ...sizesChoice, list: true }, ['S', 'L']))).toEqual(['S', 'L'])
  })
  it('needs its choices', () => {
    expect(ruleProblems('Size', 'choice', {})).toEqual([
      'Size: add the choices to pick from, one per line',
    ])
    expect(ruleProblems('Size', 'choice', { choices: ['S', 'S'] })).toEqual([
      'Size: each choice can be there only once',
    ])
  })
})

describe('link', () => {
  it('keeps the text and a web or store address', () => {
    expect(
      ok(validateFieldValue(rule('link'), { label: ' Size chart ', url: '/pages/size-chart' })),
    ).toEqual({ label: 'Size chart', url: '/pages/size-chart' })
    expect(ok(validateFieldValue(rule('link'), { label: '', url: 'https://x.in' }))).toEqual({
      label: '',
      url: 'https://x.in',
    })
    expect(validateFieldValue(rule('link'), { label: 'x', url: 'javascript:alert(1)' }).ok).toBe(
      false,
    )
    expect(validateFieldValue(rule('link'), { label: 'x', url: '//evil.com' }).ok).toBe(false)
    expect(validateFieldValue(rule('link'), { label: 'Only text', url: '' }).ok).toBe(false)
    expect(isEmptyValue({ label: '', url: '' })).toBe(true)
  })
})

describe('rating', () => {
  it('stores the value with its scale, in whole or half stars', () => {
    expect(ok(validateFieldValue(rule('rating'), 4))).toEqual({ value: 4, max: 5 })
    expect(ok(validateFieldValue(rule('rating'), { value: 4.5 }))).toEqual({ value: 4.5, max: 5 })
    const ten = rule('rating', { validations: { ratingMax: 10 } })
    expect(ok(validateFieldValue(ten, 9))).toEqual({ value: 9, max: 10 })
    expect(validateFieldValue(rule('rating'), 6).ok).toBe(false)
    expect(validateFieldValue(rule('rating'), 3.3).ok).toBe(false)
    expect(ratingText({ value: 4.5, max: 5 })).toBe('4.5/5')
    expect(ruleProblems('R', 'number_integer', { ratingMax: 5 })).toHaveLength(1)
  })
})

describe('measurement', () => {
  const weight = rule('measurement', { validations: { measure: 'weight' } })
  it('needs a number and a unit of its kind', () => {
    expect(ok(validateFieldValue(weight, { value: '1.5', unit: 'kg' }))).toEqual({
      value: 1.5,
      unit: 'kg',
    })
    expect(validateFieldValue(weight, { value: 1, unit: 'cm' })).toEqual({
      ok: false,
      error: 'Field needs a unit: g, kg, oz, lb',
    })
    expect(validateFieldValue(weight, { value: -1, unit: 'kg' }).ok).toBe(false)
    expect(ruleProblems('W', 'measurement', {})).toEqual(['W: pick weight, length or volume'])
    expect(measurementText({ value: 250, unit: 'fl_oz' })).toBe('250 fl oz')
  })
})

describe('page, variant and blog post references', () => {
  it('take ids and are collected for the existence check', () => {
    expect(ok(validateFieldValue(rule('page_reference'), ID.toUpperCase()))).toBe(ID)
    expect(validateFieldValue(rule('article_reference'), 'about').ok).toBe(false)
    const uses = collectReferences(
      [
        { ...rule('page_reference'), source: 'p' },
        { ...rule('variant_reference', { list: true }), source: 'v' },
        { ...rule('article_reference'), source: 'a' },
      ],
      { p: ID, v: [ID, ID2], a: ID2 },
    )
    expect(uses.map((u) => `${u.type}:${u.source}`)).toEqual([
      'page_reference:p',
      'variant_reference:v',
      'variant_reference:v',
      'article_reference:a',
    ])
  })
})

describe('group', () => {
  it('checks every row, drops blank rows and unknown keys', () => {
    const value = ok(
      validateFieldValue(sizes, [
        { size: ' S ', chest: { value: 36, unit: 'in' }, extra: 'x' },
        { size: '', chest: null },
        { size: 'M', photo: ID },
      ]),
    )
    expect(value).toEqual([
      { size: 'S', chest: { value: 36, unit: 'in' } },
      { size: 'M', photo: ID },
    ])
  })

  it('names the row that is wrong', () => {
    expect(validateFieldValue(sizes, [{ size: 'S' }, { chest: { value: 1, unit: 'cm' } }])).toEqual(
      {
        ok: false,
        error: 'Sizes row 2: Size is required',
      },
    )
    expect(validateFieldValue(sizes, 'S').ok).toBe(false)
  })

  it('collects files picked in rows', () => {
    const uses = collectReferences([{ ...sizes, source: 'rows' }], {
      rows: [{ size: 'S', photo: ID }, { size: 'M' }],
    })
    expect(uses).toEqual([{ type: 'file', id: ID, source: 'rows' }])
  })

  it('needs plain row fields with their own keys, and cannot be a list', () => {
    expect(ruleProblems('G', 'group', {})).toEqual(['G: add at least one field to each row'])
    expect(
      ruleProblems('G', 'group', {
        subfields: [
          { key: 'a', name: 'A', type: 'choice', required: false },
          { key: 'a', name: 'B', type: 'color', required: false },
        ],
      }),
    ).toEqual([
      'G › A: add the choices to pick from, one per line',
      'G: two row fields use the key a',
    ])
    expect(
      MetaobjectDefinitionWriteSchema.safeParse({
        name: 'X',
        fields: [
          {
            key: 'g',
            name: 'G',
            type: 'group',
            validations: { subfields: [{ key: 'p', name: 'P', type: 'product_reference' }] },
          },
        ],
      }).success,
    ).toBe(false)
    expect(
      definitionProblems(
        [
          {
            key: 'g',
            name: 'G',
            type: 'group',
            list: true,
            required: false,
            validations: sizes.validations,
          },
        ],
        null,
      ),
    ).toEqual(['G cannot be a list'])
  })
})

describe('field change lock', () => {
  const title: FieldDefinition = {
    key: 'title',
    name: 'Title',
    type: 'single_line_text',
    list: false,
    required: false,
  }
  const price: FieldDefinition = {
    key: 'price',
    name: 'Price',
    type: 'money',
    list: false,
    required: false,
  }

  it('refuses a new kind of value while entries hold data', () => {
    const changed = { ...title, type: 'choice' as const, validations: { choices: ['a'] } }
    expect(fieldChangeProblems([title], [changed], { title: 3 })).toEqual([
      'Title already has values in 3 entries, so what goes in it cannot change. Add a new field instead, or clear it in those entries first',
    ])
    expect(fieldChangeProblems([title], [changed], {})).toEqual([])
    expect(fieldChangeProblems([title], [{ ...title, list: true }], { title: 1 })).toHaveLength(1)
    expect(
      fieldChangeProblems([price], [{ ...price, validations: { currency: 'USD' } }], { price: 1 }),
    ).toHaveLength(1)
  })

  it('allows renaming, rules and adding row fields', () => {
    expect(
      fieldChangeProblems([title], [{ ...title, name: 'Name', required: true }], { title: 2 }),
    ).toEqual([])
    const group = {
      key: 'rows',
      name: 'Rows',
      type: 'group' as const,
      list: false,
      required: false,
      validations: sizes.validations,
    }
    const more = {
      ...group,
      validations: {
        subfields: [
          ...(sizes.validations?.subfields ?? []),
          { key: 'hips', name: 'Hips', type: 'single_line_text' as const, required: false },
        ],
      },
    }
    expect(fieldChangeProblems([group], [more], { rows: 4 })).toEqual([])
    const retyped = {
      ...group,
      validations: {
        subfields: [{ key: 'size', name: 'Size', type: 'number_integer' as const, required: true }],
      },
    }
    expect(fieldChangeProblems([group], [retyped], { rows: 4 })).toHaveLength(1)
  })

  it('refuses old data under a key added back, unless it fits', () => {
    expect(fieldChangeProblems([], [title], { title: 2 })).toEqual([
      '2 entries still hold old values under the key title. Give Title another key',
    ])
    expect(fieldChangeProblems([], [title], { title: 2 }, new Set(['title']))).toEqual([])
  })
})
