import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  THEME_EDIT_SUMMARY_MAX,
  THEME_OUTLINE_LIMITS,
  ThemeEditInput,
  type ThemeOutline,
  themeEditSummary,
  validateThemeEdits,
} from '../src/assistant/theme-outline'
import { type AiRuntime, generateStructured } from '../src/engine'
import {
  clampSectionProposal,
  SECTION_WRITER_LIMITS,
  SectionProposalSchema,
} from '../src/section-writer'
import { textModel } from '../src/testing'

const runtime: AiRuntime = {
  storeId: 'store-a',
  userId: 'user-1',
  plan: 'starter',
  feature: 'productWriter',
}

const LIMIT_KEYWORDS = ['maxItems', 'minItems', 'maxLength', 'minLength']
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')

describe('model schemas carry no limits', () => {
  it.each([
    ['section writer', SectionProposalSchema],
    ['theme edit', ThemeEditInput],
  ])('%s', (_, schema) => {
    const json = JSON.stringify(z.toJSONSchema(schema))
    for (const keyword of LIMIT_KEYWORDS) expect(json).not.toContain(keyword)
  })
})

describe('section writer', () => {
  it('accepts an over-long FAQ answer and trims it', async () => {
    const answer = {
      summary: words(60),
      section: {
        type: 'Faq',
        heading: words(30),
        items: Array.from({ length: 11 }, (_, i) => ({
          question: `${words(40)} ${i}?`,
          answer: words(120),
        })),
      },
    }
    const { output } = await generateStructured({
      runtime,
      model: textModel(JSON.stringify(answer)),
      schema: SectionProposalSchema,
      instructions: 'x',
      content: [{ type: 'text', text: 'x' }],
    })
    const p = clampSectionProposal(output)
    expect(p.summary.length).toBeLessThanOrEqual(SECTION_WRITER_LIMITS.summary)
    if (p.section.type !== 'Faq') throw new Error('expected an FAQ')
    expect(p.section.heading.length).toBeLessThanOrEqual(SECTION_WRITER_LIMITS.heading)
    expect(p.section.items).toHaveLength(SECTION_WRITER_LIMITS.items)
    for (const item of p.section.items) {
      expect(item.question.length).toBeLessThanOrEqual(SECTION_WRITER_LIMITS.question)
      expect(item.answer.length).toBeLessThanOrEqual(SECTION_WRITER_LIMITS.answer)
    }
  })

  it('drops extra columns and trims a long button label', () => {
    const p = clampSectionProposal({
      summary: 'Why shop with us.',
      section: {
        type: 'Multicolumn',
        kicker: '',
        heading: 'Why Waimers',
        columns: Array.from({ length: 6 }, () => ({ title: words(20), text: words(80) })),
      },
    })
    if (p.section.type !== 'Multicolumn') throw new Error('expected columns')
    expect(p.section.columns).toHaveLength(SECTION_WRITER_LIMITS.columns)
    expect(p.section.columns[0]?.title.length).toBeLessThanOrEqual(
      SECTION_WRITER_LIMITS.columnTitle,
    )
  })
})

const outline: ThemeOutline = {
  themeName: 'Dawn',
  templateLabel: 'Home page',
  published: true,
  selectedSectionId: null,
  partial: false,
  sections: [
    {
      id: 'Hero-1',
      zone: 'main',
      type: 'Hero',
      label: 'Hero',
      settings: [{ key: 'heading', label: 'Heading', kind: 'text', value: 'Hello' }],
      blocks: [],
    },
  ],
}

describe('theme edit', () => {
  it('accepts an over-long summary and trims it for the card', () => {
    const input = ThemeEditInput.parse({
      summary: words(80),
      edits: [{ sectionId: 'Hero-1', setting: 'heading', value: 'New heading' }],
    })
    expect(validateThemeEdits(outline, input).ok).toBe(true)
    const summary = themeEditSummary(input)
    expect(summary.length).toBeLessThanOrEqual(THEME_EDIT_SUMMARY_MAX)
    expect(summary.endsWith('…')).toBe(true)
    expect(themeEditSummary({ ...input, summary: '  ' })).toBe('Theme edit')
  })

  it('tells the model to fix too many changes, none, or a too-long value', () => {
    const one = { sectionId: 'Hero-1', setting: 'heading', value: 'x' }
    const check = (edits: unknown[]) =>
      validateThemeEdits(outline, ThemeEditInput.parse({ summary: 'x', edits }))
    expect(check(Array.from({ length: THEME_OUTLINE_LIMITS.maxEdits + 1 }, () => one))).toEqual({
      ok: false,
      error: expect.stringContaining('At most'),
    })
    expect(check([])).toEqual({ ok: false, error: 'Add at least one change.' })
    const long = { ...one, value: 'x'.repeat(THEME_OUTLINE_LIMITS.maxEditValue + 1) }
    expect(check([long])).toEqual({ ok: false, error: expect.stringContaining('longer than') })
  })
})
