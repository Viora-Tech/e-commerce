/** SOURCE OF TRUTH: Edit code check tests — JSON, CSS and Liquid problems with their line and column, native file names, and the server's Liquid parse */
import { describe, expect, it } from 'vitest'
import { checkCss, checkJson, checkLiquid, codeLanguage } from './check'
import { codeProblems } from './files'
import { nativeTemplatePath, parseAlternateName, parseNativeTemplatePath } from './paths'

describe('checkJson', () => {
  it('accepts JSON, and comments and trailing commas only when loose', () => {
    expect(checkJson('{"a": [1, 2, {"b": null}]}')).toEqual([])
    expect(checkJson('/* hi */ {"a": 1,}', { loose: true })).toEqual([])
    expect(checkJson('{"a": 1,}')).toHaveLength(1)
  })

  it('names the line and column where a comma is missing', () => {
    const text = '{\n  "a": {\n    "type": "trust-strip"\n    "settings": {}\n  }\n}'
    expect(checkJson(text)).toEqual([
      { line: 3, column: 26, message: 'Expected "," after property value' },
    ])
  })

  it('reports text that is never closed', () => {
    expect(checkJson('{"a": "b}')[0]?.message).toBe('Text is not closed: add the closing "')
  })
})

describe('checkCss', () => {
  it('pairs braces', () => {
    expect(checkCss('a { color: red; }')).toEqual([])
    expect(checkCss('a { color: red;')[0]?.message).toBe('This "{" is never closed')
    expect(checkCss('a {}\n}')[0]).toMatchObject({ line: 2, column: 1 })
  })
})

describe('checkLiquid', () => {
  it('accepts paired tags and a valid schema', () => {
    const ok = '{% if a %}{{ a }}{% else %}b{% endif %}{% schema %}{"name": "X"}{% endschema %}'
    expect(checkLiquid(ok)).toEqual([])
  })

  it('finds an unclosed tag, a stray end tag and a broken schema', () => {
    expect(checkLiquid('{% for p in list %}x')[0]?.message).toContain('{% for %} is never closed')
    expect(checkLiquid('x{% endif %}')[0]?.message).toBe('{% endif %} has no matching {% if %}')
    expect(checkLiquid('{{ a ')[0]?.message).toBe('Add the closing }}')
    const schema = checkLiquid(
      '{% schema %}\n{\n  "name": "X"\n  "settings": []\n}\n{% endschema %}',
    )
    expect(schema[0]).toMatchObject({
      line: 3,
      message: 'Schema: Expected "," after property value',
    })
  })

  it('ignores tags inside raw and comment', () => {
    expect(
      checkLiquid('{% raw %}{% if %}{% endraw %}{% comment %}{% for %}{% endcomment %}'),
    ).toEqual([])
  })
})

describe('codeProblems (server)', () => {
  it('runs the theme engine parser after the quick checks', () => {
    expect(codeProblems('sections/a.liquid', '{{ product.title | upcase }}')).toEqual([])
    expect(codeProblems('sections/a.liquid', '{% assign %}')).toHaveLength(1)
  })
})

describe('paths', () => {
  it('maps native templates to Shopify file names and back', () => {
    expect(nativeTemplatePath('home', '')).toBe('templates/index.json')
    expect(nativeTemplatePath('product', 'preorder')).toBe('templates/product.preorder.json')
    expect(nativeTemplatePath('header', '')).toBe('sections/header-group.json')
    expect(parseNativeTemplatePath('templates/404.json')).toEqual({
      template: 'not_found',
      suffix: '',
    })
    expect(parseNativeTemplatePath('templates/product.preorder.json')).toEqual({
      template: 'product',
      suffix: 'preorder',
    })
    expect(parseNativeTemplatePath('templates/nope.json')).toBeNull()
    expect(parseAlternateName('product.preorder')).toEqual({
      template: 'product',
      suffix: 'preorder',
    })
    expect(parseAlternateName('home.x')).toBeNull()
    expect(codeLanguage('assets/base.css')).toBe('css')
  })
})
