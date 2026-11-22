/**
 * SOURCE OF TRUTH KEYWORDS: compact theme HTML, Liquid whitespace, HTML weight
 * WHAT:  An imported theme's rendered Liquid with the indentation taken out: whitespace between
 *        attributes inside a tag becomes one space, and in text every run of whitespace that
 *        holds a line break keeps only its line breaks (the spaces and tabs around them go).
 * WHY:   Liquid keeps the template's indentation, so a Zero Drift page carried 40 to 70 KB of
 *        spaces (measured on waimers.in, 22 Nov 2026). The page draws the same: the DOM keeps
 *        every node (a whitespace-only text node stays, as its line breaks), `white-space:
 *        normal`, `nowrap` and `pre-line` draw it identically, and attribute values are never
 *        touched. Raw-text elements (`script`, `style`, `pre`, `textarea`...) and SVG `<text>`,
 *        whose whitespace rules differ, are copied as they are.
 * WHERE: `liquid-theme.ts`, on each section and layout part as it is rendered, before the
 *        render cache keeps it.
 */

/** Elements whose content is copied byte for byte. */
const RAW = new Set([
  'script',
  'style',
  'pre',
  'textarea',
  'title',
  'noscript',
  'xmp',
  'listing',
  'plaintext',
  'text',
])

/** A run of whitespace in text: its line breaks alone when it has any, else as it is. */
function compactText(text: string): string {
  return text.replace(/[ \t\f\r\n]+/g, (run) => {
    const breaks = run.replace(/\r\n?/g, '\n').replace(/[^\n]/g, '')
    return breaks || run
  })
}

const isSpace = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f'

/**
 * The tag that opens at `start`, with the whitespace between its parts made one space (none
 * before its `>`), and the index after it; null when it never closes. A quote opens a value
 * only straight after `=` (as the HTML parser reads it), and a value is copied as it is.
 */
function scanTag(html: string, start: number): { tag: string; end: number } | null {
  let tag = '<'
  let quote = ''
  let space = false
  let prev = ''
  for (let i = start + 1; i < html.length; i++) {
    const c = html[i] as string
    if (quote) {
      tag += c
      if (c === quote) quote = ''
      continue
    }
    if (isSpace(c)) {
      space = true
      continue
    }
    if (c === '>') return { tag: `${tag}>`, end: i + 1 }
    if (space && prev !== '=' && c !== '=') tag += ' '
    space = false
    if ((c === '"' || c === "'") && prev === '=') quote = c
    tag += c
    prev = c
  }
  return null
}

/** `html` with its indentation removed; renders the same (see the header comment). */
export function compactThemeHtml(html: string): string {
  let out = ''
  let i = 0
  while (i < html.length) {
    const lt = html.indexOf('<', i)
    if (lt === -1) {
      out += compactText(html.slice(i))
      break
    }
    out += compactText(html.slice(i, lt))
    const next = html[lt + 1] ?? ''
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4)
      const stop = end === -1 ? html.length : end + 3
      out += html.slice(lt, stop)
      i = stop
      continue
    }
    if (!/[a-zA-Z/!?]/.test(next)) {
      out += '<'
      i = lt + 1
      continue
    }
    const scanned = scanTag(html, lt)
    if (!scanned) {
      out += html.slice(lt)
      break
    }
    const { tag, end } = scanned
    out += tag
    i = end
    const name = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(tag)?.[1]?.toLowerCase()
    if (name && RAW.has(name) && !tag.endsWith('/>')) {
      const closer = new RegExp(`</${name}`, 'gi')
      closer.lastIndex = i
      const stop = closer.exec(html)?.index ?? html.length
      out += html.slice(i, stop)
      i = stop
    }
  }
  return out
}
