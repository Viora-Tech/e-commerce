/** SOURCE OF TRUTH: list binding tests (pure) — loop format, finding loops, filling rows, fallbacks, Save's loop check */
import { describe, expect, it } from 'vitest'
import {
  applyLoops,
  boundLoops,
  LOOP_MAX,
  type LoopBinding,
  linkLoop,
  loopKey,
  loopLimit,
  loopProblems,
  parseLoopSource,
  unlinkLoop,
} from './loops'
import { applyBindings } from './resolve'

const typed = [{ question: 'Typed?', answer: 'Yes', open: true }]

const faqLoop = (limit = 6): LoopBinding => ({
  $loop: {
    source: 'metaobject:faq',
    limit,
    map: {
      question: { from: 'question', kind: 'text' },
      answer: { from: 'answer', kind: 'richtext' },
    },
  },
  fallback: typed,
})

const template = (items: unknown) => ({
  root: { props: {} },
  content: [{ type: 'FaqSplit', props: { id: 'f', heading: 'FAQ', items } }],
})

describe('loop format', () => {
  it('reads metaobject and collection sources and refuses anything else', () => {
    expect(parseLoopSource('metaobject:faq')).toEqual({ scope: 'metaobject', type: 'faq' })
    expect(parseLoopSource('collection:summer-sale.products')).toEqual({
      scope: 'collection_products',
      handle: 'summer-sale',
    })
    expect(parseLoopSource('metaobject:Bad Type')).toBeNull()
    expect(parseLoopSource('collection:x')).toBeNull()
    expect(parseLoopSource('product.title')).toBeNull()
  })

  it('caps every list at 50 rows and keeps at least one', () => {
    expect(loopLimit({ limit: 500 })).toBe(LOOP_MAX)
    expect(loopLimit({ limit: 0 })).toBe(LOOP_MAX)
    expect(loopLimit({ limit: -3 })).toBe(1)
    expect(loopKey({ source: 'metaobject:faq', limit: 99 })).toBe('metaobject:faq#50')
  })

  it('links keeping the typed rows as the fallback, and unlinks back to them', () => {
    const loop = linkLoop('metaobject:faq', 4, faqLoop().$loop.map, typed)
    expect(loop.fallback).toEqual(typed)
    expect(unlinkLoop(loop)).toEqual(typed)
    // Relinking a loop keeps its original rows, not an empty list.
    expect(linkLoop('metaobject:team', 4, {}, loop).fallback).toEqual(typed)
  })
})

describe('filling a loop', () => {
  it('finds loops in sections and nested zones once per source and limit', () => {
    const data = {
      ...template(faqLoop()),
      zones: { 'g:content': [{ type: 'FaqSplit', props: { id: 'g', items: faqLoop() } }] },
    }
    expect(boundLoops(data).map(loopKey)).toEqual(['metaobject:faq#6'])
  })

  it('maps each loaded row into an item, coercing by kind and keeping the first row’s other settings', () => {
    const out = applyLoops(template(faqLoop(1)), {
      'metaobject:faq#1': [
        {
          question: { type: 'single_line_text', value: 'Shipping?' },
          answer: { type: 'multi_line_text', value: 'Two days' },
        },
        { question: { type: 'single_line_text', value: 'Beyond the limit' } },
      ],
    })
    expect(out.content[0]?.props.items).toEqual([
      { question: 'Shipping?', answer: 'Two days', open: true },
    ])
  })

  it('shows the typed rows when the list is empty or was not loaded', () => {
    expect(
      applyLoops(template(faqLoop()), { 'metaobject:faq#6': [] }).content[0]?.props.items,
    ).toEqual(typed)
    expect(applyLoops(template(faqLoop())).content[0]?.props.items).toEqual(typed)
  })

  it('lets applyBindings alone (the editor, no store) show the typed rows too', () => {
    expect(applyBindings(template(faqLoop())).content[0]?.props.items).toEqual(typed)
  })
})

describe('loopProblems', () => {
  it('names unknown sources, missing content types and unreadable maps', () => {
    const bad: LoopBinding = {
      $loop: {
        source: 'metaobject:gone',
        limit: 3,
        map: { q: { from: 'q', kind: 'nope' as never } },
      },
    }
    expect(loopProblems(template(bad), new Set(['faq']))).toEqual([
      'A list reads the content type "gone", which no longer exists',
      'A list maps "q" in a way that cannot be read',
    ])
    expect(loopProblems(template({ $loop: { source: 'x', limit: 1, map: {} } }))).toEqual([
      'A list reads an unknown source (x)',
    ])
    expect(loopProblems(template(faqLoop()), new Set(['faq']))).toEqual([])
  })
})
