/** SOURCE OF TRUTH: template data tests — WHAT: default templates and dropping Liquid sections / WHY: templates stay valid after import */
import { describe, expect, it } from 'vitest'
import { defaultTemplate, withoutLiquidSections } from './templates-data'

const liquid = (key: string, hidden = false) => ({
  type: 'LiquidSection',
  props: { id: `LiquidSection-${key}`, sectionType: key, ...(hidden ? { _hidden: true } : {}) },
})
const ours = (type: string, id: string, hidden = false) => ({
  type,
  props: { id, ...(hidden ? { _hidden: true } : {}) },
})

describe('withoutLiquidSections', () => {
  it('leaves a template without Shopify sections exactly as stored', () => {
    const stored = { root: { props: { title: 'x' } }, content: [ours('Hero', 'hero')], zones: {} }
    expect(withoutLiquidSections('home', stored)).toBe(stored)
    expect(withoutLiquidSections('home', 'not a template')).toBe('not a template')
  })

  it('keeps our sections and drops the Shopify ones', () => {
    const stored = {
      root: { props: {} },
      content: [liquid('banner'), ours('MainProduct', 'main'), liquid('related')],
    }
    expect(withoutLiquidSections('product', stored)).toEqual({
      root: { props: {} },
      content: [ours('MainProduct', 'main')],
    })
  })

  it('falls back to our default when nothing visible is left', () => {
    const allLiquid = { root: { props: {} }, content: [liquid('hero'), liquid('footer')] }
    expect(withoutLiquidSections('home', allLiquid)).toEqual(defaultTemplate('home'))
    expect(withoutLiquidSections('footer', allLiquid)).toEqual(defaultTemplate('footer'))
    const onlyHidden = {
      root: { props: {} },
      content: [liquid('hero'), ours('RichText', 'rich', true)],
    }
    expect(withoutLiquidSections('page', onlyHidden)).toEqual(defaultTemplate('page'))
  })
})
