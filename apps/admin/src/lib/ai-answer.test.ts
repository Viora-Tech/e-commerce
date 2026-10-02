import { describe, expect, it } from 'vitest'
import { parseAnswer, spans } from './ai-answer'

describe('parseAnswer', () => {
  it('splits paragraphs and bullet lists, with bold runs', () => {
    expect(
      parseAnswer('Sales were **₹12,450** this week.\n\n- Orders: 14\n- Average: ₹889\n\nNice.'),
    ).toEqual([
      {
        type: 'p',
        spans: [
          { text: 'Sales were ', bold: false },
          { text: '₹12,450', bold: true },
          { text: ' this week.', bold: false },
        ],
      },
      {
        type: 'ul',
        items: [[{ text: 'Orders: 14', bold: false }], [{ text: 'Average: ₹889', bold: false }]],
      },
      { type: 'p', spans: [{ text: 'Nice.', bold: false }] },
    ])
  })

  it('drops heading marks and keeps numbered lists as lists', () => {
    expect(parseAnswer('## Stock\n1. Mouse: 2 left')).toEqual([
      { type: 'p', spans: [{ text: 'Stock', bold: false }] },
      { type: 'ul', items: [[{ text: 'Mouse: 2 left', bold: false }]] },
    ])
  })

  it('leaves an unfinished bold run as text while streaming', () => {
    expect(spans('Sales were **₹12')).toEqual([
      { text: 'Sales were ', bold: false },
      { text: '**₹12', bold: false },
    ])
  })
})
