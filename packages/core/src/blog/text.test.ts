import { describe, expect, it } from 'vitest'
import {
  articleExcerpt,
  displayStatus,
  isArticleVisible,
  normaliseTags,
  readingMinutes,
  richTextToText,
} from './text'

const doc = (...paragraphs: string[]) => ({
  root: {
    type: 'root',
    children: paragraphs.map((text) => ({
      type: 'paragraph',
      children: [{ type: 'text', text }],
    })),
  },
})

describe('richTextToText', () => {
  it('joins Lexical blocks with newlines and inline runs without', () => {
    const body = {
      root: {
        type: 'root',
        children: [
          { type: 'heading', children: [{ type: 'text', text: 'Launch ' }, { text: 'day' }] },
          { type: 'paragraph', children: [{ type: 'text', text: 'New glasspads.' }] },
        ],
      },
    }
    expect(richTextToText(body)).toBe('Launch day\nNew glasspads.')
  })

  it('accepts JSON strings and legacy plain text', () => {
    expect(richTextToText(JSON.stringify(doc('Hello')))).toBe('Hello')
    expect(richTextToText('  plain words  ')).toBe('plain words')
    expect(richTextToText(null)).toBe('')
  })

  it('reads an imported HTML body as words, one block a line', () => {
    expect(
      richTextToText(
        '<h2>Start with your hand</h2>\n<p>Almost every mouse &amp; pad tracks&nbsp;well.</p>',
      ),
    ).toBe('Start with your hand\nAlmost every mouse & pad tracks well.')
  })
})

describe('articleExcerpt', () => {
  it('prefers the merchant excerpt', () => {
    expect(articleExcerpt('  Hand written.  ', doc('Body text'))).toBe('Hand written.')
    expect(articleExcerpt('<p>Hand <b>written</b>.</p>', doc('Body text'))).toBe('Hand written.')
  })

  it('falls back to the body, cut at a word boundary with an ellipsis', () => {
    const long = 'Speed and control in one surface, tuned for flick shots and slow tracking alike. '
    const excerpt = articleExcerpt(null, doc(long.repeat(4)), 80)
    expect(excerpt.length).toBeLessThanOrEqual(81)
    expect(excerpt.endsWith('…')).toBe(true)
    expect(excerpt).not.toMatch(/\s…$/)
  })

  it('returns short bodies whole', () => {
    expect(articleExcerpt('', doc('Short post.'))).toBe('Short post.')
  })
})

describe('readingMinutes', () => {
  it('rounds at 200 words a minute, never below one', () => {
    expect(readingMinutes(doc('a few words'))).toBe(1)
    expect(readingMinutes(doc(Array.from({ length: 1000 }, () => 'word').join(' ')))).toBe(5)
  })
})

describe('normaliseTags', () => {
  it('trims, collapses spaces and removes case-insensitive duplicates keeping the first spelling', () => {
    expect(normaliseTags([' Glasspads ', 'glasspads', 'Launch  news', '', 'Esports'])).toEqual([
      'Glasspads',
      'Launch news',
      'Esports',
    ])
  })
})

describe('visibility', () => {
  const now = new Date('2026-09-23T10:00:00Z')

  it('hides drafts and undated posts', () => {
    expect(isArticleVisible('draft', now, now)).toBe(false)
    expect(isArticleVisible('published', null, now)).toBe(false)
  })

  it('shows published posts and scheduled ones once due', () => {
    expect(isArticleVisible('published', '2026-09-01T00:00:00Z', now)).toBe(true)
    expect(isArticleVisible('scheduled', '2026-09-23T09:59:59Z', now)).toBe(true)
    expect(isArticleVisible('scheduled', '2026-09-24T00:00:00Z', now)).toBe(false)
  })

  it('reports a due scheduled post as published in the admin', () => {
    expect(displayStatus('scheduled', '2026-09-23T09:00:00Z', now)).toBe('published')
    expect(displayStatus('scheduled', '2026-09-30T09:00:00Z', now)).toBe('scheduled')
  })
})
