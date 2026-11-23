/**
 * The small formatting a text block understands when `rich` is on, written the way the editor's
 * toolbar inserts it: `**bold**`, `*italic*`, `[words](https://link)`, lines starting `- ` for a
 * list and `1. ` for a numbered list, a blank line between paragraphs. Parsed into a tree the
 * email draws with inline styles; the words are never read as HTML. Pure.
 */

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'b'; c: Inline[] }
  | { t: 'i'; c: Inline[] }
  | { t: 'a'; href: string; c: Inline[] }

/** A paragraph's lines, or a list's items. */
export type RichBlock = (
  | { t: 'p'; lines: Inline[][] }
  | { t: 'ul'; items: Inline[][] }
  | { t: 'ol'; items: Inline[][] }
) & {
  /** Set while parsing: a blank line ended it. */
  closed?: boolean
}

const INLINE = /\*\*(.+?)\*\*|\*([^*\s][^*]*?)\*|\[([^\]]+)\]\(([^)\s]+)\)/

const SAFE = /^(https?:\/\/[^\s"'<>]+|mailto:[^\s"'<>]+)$/i

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  let rest = text
  while (rest) {
    const m = INLINE.exec(rest)
    if (!m) {
      out.push({ t: 'text', v: rest })
      break
    }
    if (m.index > 0) out.push({ t: 'text', v: rest.slice(0, m.index) })
    if (m[1] !== undefined) out.push({ t: 'b', c: parseInline(m[1]) })
    else if (m[2] !== undefined) out.push({ t: 'i', c: parseInline(m[2]) })
    else {
      const href = m[4] ?? ''
      const label = parseInline(m[3] ?? '')
      // A link that is not http(s) or mailto keeps only its words.
      if (SAFE.test(href)) out.push({ t: 'a', href, c: label })
      else out.push(...label)
    }
    rest = rest.slice(m.index + m[0].length)
  }
  return out
}

const BULLET = /^\s*[-*•]\s+/
const NUMBER = /^\s*\d{1,3}[.)]\s+/

/** Paragraphs and lists of a text, in order. */
export function parseRichText(text: string): RichBlock[] {
  const out: RichBlock[] = []
  for (const para of text.split(/\n{2,}/)) {
    for (const line of para.split('\n')) {
      if (line.trim() === '') continue
      const kind = BULLET.test(line) ? 'ul' : NUMBER.test(line) ? 'ol' : 'p'
      const body = parseInline(line.replace(kind === 'ul' ? BULLET : NUMBER, '').trim())
      const prev = out[out.length - 1]
      if (prev && prev.t === kind && !prev.closed) {
        if (prev.t === 'p') prev.lines.push(body)
        else prev.items.push(body)
      } else {
        out.push(kind === 'p' ? { t: 'p', lines: [body] } : { t: kind, items: [body] })
      }
    }
    const last = out[out.length - 1]
    if (last) last.closed = true
  }
  for (const b of out) delete b.closed
  return out
}

/** The text without its marks, for the plain-text part ("Words (https://link)"). */
export function richToPlain(text: string): string {
  const flat = (nodes: Inline[]): string =>
    nodes
      .map((n) => (n.t === 'text' ? n.v : n.t === 'a' ? `${flat(n.c)} (${n.href})` : flat(n.c)))
      .join('')
  return parseRichText(text)
    .map((b) =>
      b.t === 'p'
        ? b.lines.map(flat).join('\n')
        : b.items.map((item, i) => `${b.t === 'ul' ? '-' : `${i + 1}.`} ${flat(item)}`).join('\n'),
    )
    .join('\n\n')
}
