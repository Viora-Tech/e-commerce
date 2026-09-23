import { METAFIELD_TYPES } from '@commerce/db'
import { describe, expect, it } from 'vitest'
import { FIELD_TYPES, type FieldDefinition } from './schemas'
import {
  collectReferences,
  definitionProblems,
  entryDisplayName,
  type FieldRule,
  keyFromName,
  ruleProblems,
  validateFields,
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

describe('field types', () => {
  it('matches the database list', () => {
    expect([...FIELD_TYPES]).toEqual([...METAFIELD_TYPES])
  })

  it('single line text trims, rejects newlines, enforces length and choices', () => {
    expect(ok(validateFieldValue(rule('single_line_text'), '  Cotton  '))).toBe('Cotton')
    expect(validateFieldValue(rule('single_line_text'), 'a\nb').ok).toBe(false)
    expect(validateFieldValue(rule('single_line_text'), 42).ok).toBe(false)
    const short = rule('single_line_text', { validations: { maxLength: 3 } })
    expect(validateFieldValue(short, 'abcd')).toEqual({
      ok: false,
      error: 'Field must be 3 characters or fewer',
    })
    const min = rule('single_line_text', { validations: { minLength: 3 } })
    expect(validateFieldValue(min, 'ab').ok).toBe(false)
    const pick = rule('single_line_text', { validations: { choices: ['S', 'M'] } })
    expect(ok(validateFieldValue(pick, 'M'))).toBe('M')
    expect(validateFieldValue(pick, 'L').ok).toBe(false)
  })

  it('multi line text keeps line breaks', () => {
    expect(ok(validateFieldValue(rule('multi_line_text'), 'a\r\nb'))).toBe('a\nb')
    expect(validateFieldValue(rule('multi_line_text'), {}).ok).toBe(false)
  })

  it('rich text must be a Lexical document', () => {
    const doc = { root: { children: [] } }
    expect(ok(validateFieldValue(rule('rich_text'), doc))).toEqual(doc)
    expect(validateFieldValue(rule('rich_text'), 'plain').ok).toBe(false)
    expect(validateFieldValue(rule('rich_text'), { nope: 1 }).ok).toBe(false)
  })

  it('integers and decimals parse numeric strings and respect bounds', () => {
    expect(ok(validateFieldValue(rule('number_integer'), '12'))).toBe(12)
    expect(validateFieldValue(rule('number_integer'), 1.5).ok).toBe(false)
    expect(validateFieldValue(rule('number_integer'), '1e3').ok).toBe(false)
    expect(ok(validateFieldValue(rule('number_decimal'), '1.25'))).toBe(1.25)
    expect(validateFieldValue(rule('number_decimal'), Number.NaN).ok).toBe(false)
    const bounded = rule('number_integer', { validations: { min: 1, max: 10 } })
    expect(validateFieldValue(bounded, 0).ok).toBe(false)
    expect(validateFieldValue(bounded, 11).ok).toBe(false)
    expect(ok(validateFieldValue(bounded, 10))).toBe(10)
  })

  it('booleans accept true, false and their strings', () => {
    expect(ok(validateFieldValue(rule('boolean'), false))).toBe(false)
    expect(ok(validateFieldValue(rule('boolean'), 'true'))).toBe(true)
    expect(validateFieldValue(rule('boolean'), 'yes').ok).toBe(false)
  })

  it('dates must be real calendar days within bounds', () => {
    expect(ok(validateFieldValue(rule('date'), '2026-02-28'))).toBe('2026-02-28')
    expect(validateFieldValue(rule('date'), '2026-02-30').ok).toBe(false)
    expect(validateFieldValue(rule('date'), '28/02/2026').ok).toBe(false)
    const window = rule('date', { validations: { min: '2026-01-01', max: '2026-12-31' } })
    expect(validateFieldValue(window, '2025-12-31').ok).toBe(false)
    expect(validateFieldValue(window, '2027-01-01').ok).toBe(false)
  })

  it('urls must be http or https', () => {
    expect(ok(validateFieldValue(rule('url'), 'https://waimers.in/x'))).toBe('https://waimers.in/x')
    expect(validateFieldValue(rule('url'), 'javascript:alert(1)').ok).toBe(false)
    expect(validateFieldValue(rule('url'), 'waimers.in').ok).toBe(false)
    expect(validateFieldValue(rule('url'), `https://a.in/${'x'.repeat(3000)}`).ok).toBe(false)
  })

  it('references and files must be ids', () => {
    for (const t of [
      'file',
      'product_reference',
      'collection_reference',
      'metaobject_reference',
    ] as const) {
      expect(ok(validateFieldValue(rule(t), ID.toUpperCase()))).toBe(ID)
      expect(validateFieldValue(rule(t), 'not-an-id').ok).toBe(false)
    }
  })
})

describe('required, empty and lists', () => {
  it('treats blank input as empty and enforces required', () => {
    expect(ok(validateFieldValue(rule('single_line_text'), '   '))).toBeNull()
    expect(validateFieldValue(rule('single_line_text', { required: true }), '')).toEqual({
      ok: false,
      error: 'Field is required',
    })
    expect(validateFieldValue(rule('number_integer', { required: true }), []).ok).toBe(false)
    expect(ok(validateFieldValue(rule('boolean', { required: true }), false))).toBe(false)
  })

  it('validates each list item, drops empty ones and caps the count', () => {
    const list = rule('number_integer', { list: true, validations: { maxItems: 3 } })
    expect(ok(validateFieldValue(list, ['1', '', 2]))).toEqual([1, 2])
    expect(validateFieldValue(list, [1, 'x']).ok).toBe(false)
    expect(validateFieldValue(list, [1, 2, 3, 4]).ok).toBe(false)
    expect(validateFieldValue(list, 5).ok).toBe(false)
    expect(validateFieldValue(rule('number_integer'), [1]).ok).toBe(false)
  })

  it('validates a whole entry and drops unknown keys', () => {
    const fields: FieldDefinition[] = [
      { key: 'title', name: 'Title', type: 'single_line_text', list: false, required: true },
      { key: 'weight', name: 'Weight', type: 'number_decimal', list: false, required: false },
    ]
    expect(validateFields(fields, { title: 'Guide', extra: 'x' })).toEqual({
      values: { title: 'Guide' },
      fieldErrors: {},
    })
    expect(validateFields(fields, { weight: 'heavy' }).fieldErrors).toEqual({
      title: 'Title is required',
      weight: 'Weight must be a number',
    })
  })
})

describe('definitions', () => {
  it('derives keys from names', () => {
    expect(keyFromName('Size guide')).toBe('size_guide')
    expect(keyFromName('100% Cotton')).toBe('f_100_cotton')
    expect(keyFromName('!!!')).toBe('f')
    expect(keyFromName('Café  Menu')).toBe('cafe_menu')
  })

  it('flags duplicate keys, impossible lists and a display field that does not exist', () => {
    const f = (key: string, type: FieldDefinition['type'], list = false): FieldDefinition => ({
      key,
      name: key,
      type,
      list,
      required: false,
    })
    expect(
      definitionProblems([f('a', 'url'), f('a', 'date'), f('b', 'boolean', true)], 'zzz'),
    ).toEqual([
      'Two fields use the key a',
      'b cannot be a list',
      'The display name must be one of the fields',
    ])
  })

  it('rejects rules that do not fit the type', () => {
    expect(ruleProblems('N', 'number_integer', { min: '1' })).toHaveLength(1)
    expect(ruleProblems('D', 'date', { min: '2026-13-01' })).toHaveLength(1)
    expect(ruleProblems('N', 'number_integer', { min: 5, max: 1 })).toHaveLength(1)
    expect(ruleProblems('T', 'single_line_text', { minLength: 5, maxLength: 1 })).toHaveLength(1)
    expect(ruleProblems('U', 'url', { choices: ['a'] })).toHaveLength(1)
    expect(ruleProblems('U', 'url', { metaobjectDefinitionId: ID })).toHaveLength(1)
    expect(ruleProblems('M', 'metaobject_reference', {})).toEqual([
      'M: pick which metaobject it references',
    ])
    expect(ruleProblems('M', 'metaobject_reference', { metaobjectDefinitionId: ID })).toEqual([])
    expect(ruleProblems('X', 'url', undefined)).toEqual([])
  })

  it('collects references from single values and lists', () => {
    const uses = collectReferences(
      [
        { ...rule('product_reference', { list: true }), source: 'p' },
        {
          ...rule('metaobject_reference', { validations: { metaobjectDefinitionId: ID2 } }),
          source: 'm',
        },
        { ...rule('url'), source: 'u' },
      ],
      { p: [ID, ID2], m: ID, u: 'https://x.in' },
    )
    expect(uses).toEqual([
      { type: 'product_reference', id: ID, source: 'p', definitionId: undefined },
      { type: 'product_reference', id: ID2, source: 'p', definitionId: undefined },
      { type: 'metaobject_reference', id: ID, source: 'm', definitionId: ID2 },
    ])
  })

  it('names an entry by its display field, falling back to the handle', () => {
    expect(entryDisplayName('title', { title: ' Guide ' }, 'h')).toBe('Guide')
    expect(entryDisplayName('n', { n: 3 }, 'h')).toBe('3')
    expect(entryDisplayName(null, {}, 'h')).toBe('h')
  })
})
