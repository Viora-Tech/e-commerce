/** SOURCE OF TRUTH: Edit code's checks — WHAT: the language of a theme file from its path, and the problems in a JSON, CSS or Liquid file with their line and column / WHY: a broken file must never reach the store, and the editor marks the exact line as the merchant types (the server runs the same checks before it saves) */

export type CodeLanguage = 'liquid' | 'json' | 'css' | 'js' | 'svg' | 'text'

/** One thing wrong in a file. Lines and columns start at 1. */
export type CodeProblem = { line: number; column: number; message: string }

/** The language Edit code shows (status bar, checks) for a file path. */
export function codeLanguage(path: string): CodeLanguage {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
  if (ext === 'liquid') return 'liquid'
  if (ext === 'json') return 'json'
  if (ext === 'css' || ext === 'scss') return 'css'
  if (ext === 'js' || ext === 'mjs') return 'js'
  if (ext === 'svg') return 'svg'
  return 'text'
}

/** Line and column of a character offset. */
export function positionAt(text: string, offset: number): { line: number; column: number } {
  let line = 1
  let lineStart = 0
  const end = Math.min(offset, text.length)
  for (let i = 0; i < end; i++) {
    if (text[i] === '\n') {
      line += 1
      lineStart = i + 1
    }
  }
  return { line, column: end - lineStart + 1 }
}

class JsonProblem extends Error {
  constructor(
    readonly at: number,
    message: string,
  ) {
    super(message)
  }
}

/**
 * A small JSON reader that says where it stopped and why, in the same words in every browser
 * and on the server (engines word `JSON.parse` errors differently, and some give no position).
 * `loose` accepts the comments and trailing commas Shopify's theme JSON allows.
 */
function readJson(text: string, loose: boolean): void {
  let i = 0
  const fail = (message: string, at = i): never => {
    throw new JsonProblem(at, message)
  }
  const space = () => {
    for (;;) {
      const ch = text[i]
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        i++
      } else if (loose && ch === '/' && text[i + 1] === '*') {
        const end = text.indexOf('*/', i + 2)
        if (end === -1) fail('Comment is not closed')
        i = end + 2
      } else if (loose && ch === '/' && text[i + 1] === '/') {
        const end = text.indexOf('\n', i + 2)
        i = end === -1 ? text.length : end + 1
      } else return
    }
  }
  const string = () => {
    i++
    while (i < text.length) {
      const ch = text[i]
      if (ch === '"') {
        i++
        return
      }
      if (ch === '\n') fail('Text is not closed: add the closing "')
      i += ch === '\\' ? 2 : 1
    }
    fail('Text is not closed: add the closing "')
  }
  const literal = () => {
    const rest = text.slice(i)
    const word = /^(true|false|null|-?\d+(\.\d+)?([eE][+-]?\d+)?)/.exec(rest)
    if (!word) fail(i >= text.length ? 'The file ends too early' : 'Expected a value')
    i += word?.[0].length ?? 0
  }
  const value = (): void => {
    space()
    const ch = text[i]
    if (ch === '{') object()
    else if (ch === '[') array()
    else if (ch === '"') string()
    else literal()
  }
  const object = () => {
    i++
    space()
    if (text[i] === '}') {
      i++
      return
    }
    for (;;) {
      space()
      if (loose && text[i] === '}') {
        i++
        return
      }
      if (text[i] !== '"') fail('Expected a property name in double quotes')
      string()
      space()
      if (text[i] !== ':') fail('Expected ":" after property name')
      i++
      value()
      space()
      if (text[i] === ',') {
        i++
        continue
      }
      if (text[i] === '}') {
        i++
        return
      }
      fail('Expected "," after property value')
    }
  }
  const array = () => {
    i++
    space()
    if (text[i] === ']') {
      i++
      return
    }
    for (;;) {
      space()
      if (loose && text[i] === ']') {
        i++
        return
      }
      value()
      space()
      if (text[i] === ',') {
        i++
        continue
      }
      if (text[i] === ']') {
        i++
        return
      }
      fail('Expected "," between items')
    }
  }
  value()
  space()
  if (i < text.length) fail('Unexpected text after the end')
}

/**
 * JSON problems, at most one (a reader cannot trust what follows a mistake). The position is
 * the end of the last good token, where the merchant has to type, as editors show it.
 */
export function checkJson(text: string, options: { loose?: boolean } = {}): CodeProblem[] {
  try {
    readJson(text, options.loose ?? false)
    return []
  } catch (err) {
    if (!(err instanceof JsonProblem)) throw err
    // Report the spot right after the last non-space character before the stop.
    let at = err.at
    while (at > 0 && /\s/.test(text[at - 1] ?? '')) at--
    const { line, column } = positionAt(text, at)
    return [{ line, column, message: err.message }]
  }
}

/** CSS problems: braces that do not pair up, and comments or strings left open. */
export function checkCss(text: string): CodeProblem[] {
  const open: number[] = []
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      if (end === -1) return [{ ...positionAt(text, i), message: 'Comment is not closed' }]
      i = end + 1
    } else if (ch === '"' || ch === "'") {
      const end = text.indexOf(ch, i + 1)
      const line = text.indexOf('\n', i + 1)
      if (end === -1 || (line !== -1 && line < end)) {
        return [{ ...positionAt(text, i), message: 'Text is not closed' }]
      }
      i = end
    } else if (ch === '{') open.push(i)
    else if (ch === '}') {
      if (open.length === 0) {
        return [{ ...positionAt(text, i), message: 'This "}" has no matching "{"' }]
      }
      open.pop()
    }
  }
  const last = open.pop()
  if (last !== undefined) {
    return [{ ...positionAt(text, last), message: 'This "{" is never closed' }]
  }
  return []
}

/** Liquid tags that need an end tag, and the tags allowed between them. */
const BLOCK_TAGS: Record<string, string[]> = {
  if: ['elsif', 'else'],
  unless: ['elsif', 'else'],
  case: ['when', 'else'],
  for: ['else', 'break', 'continue'],
  tablerow: [],
  capture: [],
  form: [],
  paginate: [],
  comment: [],
  doc: [],
  raw: [],
  schema: [],
  style: [],
  stylesheet: [],
  javascript: [],
}

type OpenTag = { name: string; at: number }

/**
 * Liquid problems a merchant makes while typing: `{%` or `{{` left open, a block tag with no
 * end tag (or an end tag with no start), and a `{% schema %}` whose JSON does not read. The
 * server also runs the theme engine's own parser before saving.
 */
export function checkLiquid(text: string): CodeProblem[] {
  const stack: OpenTag[] = []
  const tagRe = /{%-?\s*(\w+)?[\s\S]*?-?%}|{{[\s\S]*?}}|{%-?|{{/g
  for (let m = tagRe.exec(text); m; m = tagRe.exec(text)) {
    const whole = m[0]
    if (whole === '{%' || whole === '{%-' || whole === '{{') {
      const closer = whole.startsWith('{{') ? '}}' : '%}'
      return [{ ...positionAt(text, m.index), message: `Add the closing ${closer}` }]
    }
    if (whole.startsWith('{{')) continue
    const name = m[1] ?? ''
    const top = stack.at(-1)
    // Inside raw or comment, only the matching end tag counts.
    if (top && (top.name === 'raw' || top.name === 'comment' || top.name === 'doc')) {
      if (name === `end${top.name}`) stack.pop()
      continue
    }
    if (name in BLOCK_TAGS) {
      stack.push({ name, at: m.index })
      if (name === 'schema') {
        const end = text.slice(tagRe.lastIndex).search(/{%-?\s*endschema\s*-?%}/)
        if (end !== -1) {
          const body = text.slice(tagRe.lastIndex, tagRe.lastIndex + end)
          const [problem] = checkJson(body, { loose: true })
          if (problem) {
            const start = positionAt(text, tagRe.lastIndex)
            return [
              {
                line: start.line + problem.line - 1,
                column: problem.line === 1 ? start.column + problem.column - 1 : problem.column,
                message: `Schema: ${problem.message}`,
              },
            ]
          }
        }
      }
      continue
    }
    if (name.startsWith('end')) {
      const opened = name.slice(3)
      if (!(opened in BLOCK_TAGS)) continue
      if (top?.name !== opened) {
        const message = top
          ? `Expected {% end${top.name} %} before {% ${name} %}`
          : `{% ${name} %} has no matching {% ${opened} %}`
        return [{ ...positionAt(text, m.index), message }]
      }
      stack.pop()
    }
  }
  const unclosed = stack.at(-1)
  if (unclosed) {
    return [
      {
        ...positionAt(text, unclosed.at),
        message: `{% ${unclosed.name} %} is never closed: add {% end${unclosed.name} %}`,
      },
    ]
  }
  return []
}

/** The problems Edit code shows for a file, by its language. */
export function checkCode(path: string, text: string): CodeProblem[] {
  switch (codeLanguage(path)) {
    case 'json':
      return checkJson(text, { loose: true })
    case 'css':
      return checkCss(text)
    case 'liquid':
      return checkLiquid(text)
    default:
      return []
  }
}
