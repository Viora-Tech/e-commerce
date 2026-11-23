/**
 * The rich text toolbar's edits on a plain textarea: wrap the selected words in `**` or `*`,
 * make them a `[words](https://)` link, or start each selected line with `- ` or `1. `. The
 * email reads the same marks (`@commerce/notifications` `rich-text.ts`). Pure.
 */

export type Mark = 'bold' | 'italic' | 'link' | 'list' | 'numbered'

export type Edited = { text: string; start: number; end: number }

const WRAP = { bold: '**', italic: '*' } as const

export function applyMark(
  text: string,
  start: number,
  end: number,
  mark: Mark,
  placeholder: string,
): Edited {
  const before = text.slice(0, start)
  const picked = text.slice(start, end)
  const after = text.slice(end)
  if (mark === 'bold' || mark === 'italic') {
    const w = WRAP[mark]
    const words = picked || placeholder
    return {
      text: `${before}${w}${words}${w}${after}`,
      start: start + w.length,
      end: start + w.length + words.length,
    }
  }
  if (mark === 'link') {
    const words = picked || placeholder
    const url = 'https://'
    const out = `[${words}](${url})`
    // Select the address so the merchant types over it.
    const urlAt = start + words.length + 3
    return { text: `${before}${out}${after}`, start: urlAt, end: urlAt + url.length }
  }
  // Lists work on whole lines: from the start of the first selected line to the end of the last.
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  const nextBreak = text.indexOf('\n', end)
  const lineEnd = nextBreak === -1 ? text.length : nextBreak
  const lines = text.slice(lineStart, lineEnd).split('\n')
  const marked = lines
    .map((l, i) => {
      const bare = l.replace(/^\s*(?:[-*•]|\d{1,3}[.)])\s+/, '')
      return mark === 'list' ? `- ${bare}` : `${i + 1}. ${bare}`
    })
    .join('\n')
  return {
    text: `${text.slice(0, lineStart)}${marked}${text.slice(lineEnd)}`,
    start: lineStart,
    end: lineStart + marked.length,
  }
}
