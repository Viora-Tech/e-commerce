/**
 * "Ask your store" answers arrive as light markdown (short paragraphs, `- ` bullets, `**bold**`).
 * This turns that text into plain blocks the answer component renders as React elements, so no
 * HTML from the model is ever injected. Pure, and safe on a half-streamed answer.
 */

export type AnswerSpan = { text: string; bold: boolean }
export type AnswerBlock = { type: 'p'; spans: AnswerSpan[] } | { type: 'ul'; items: AnswerSpan[][] }

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/

/** `**bold**` runs; an unclosed `**` (mid-stream) stays as plain text. */
export function spans(line: string): AnswerSpan[] {
  const out: AnswerSpan[] = []
  const parts = line.split('**')
  const closed = parts.length % 2 === 1
  parts.forEach((text, i) => {
    if (!text) return
    const bold = closed && i % 2 === 1
    out.push({ text: closed || i < parts.length - 1 ? text : `**${text}`, bold })
  })
  return out
}

export function parseAnswer(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = []
  let paragraph: string[] = []
  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'p', spans: spans(paragraph.join(' ')) })
    paragraph = []
  }
  for (const raw of text.split('\n')) {
    const line = raw.replace(/^#{1,6}\s+/, '').trimEnd()
    if (!line.trim()) {
      flush()
      continue
    }
    if (BULLET.test(line)) {
      flush()
      const item = spans(line.replace(BULLET, ''))
      const last = blocks.at(-1)
      if (last?.type === 'ul') last.items.push(item)
      else blocks.push({ type: 'ul', items: [item] })
      continue
    }
    paragraph.push(line.trim())
  }
  flush()
  return blocks
}
