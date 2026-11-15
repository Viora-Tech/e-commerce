/** SOURCE OF TRUTH: custom analytics query tokenizer — WHAT: words, quoted text, operators and the shared cursor / WHY: the parser, the condition parser and the suggestions read the same tokens */

export type TokenKind = 'word' | 'string' | 'punct' | 'op'

/**
 * One piece of a query with its 1-based line. `upper` is the word in capitals for keyword
 * matching; quoted text keeps `upper` empty, so `'FROM'` in quotes is never a keyword.
 */
export type Token = { text: string; upper: string; line: number; kind: TokenKind; open?: boolean }

export type QueryError = { line: number; message: string; suggestion: string | null }

const OPERATORS = ['!=', '<>', '<=', '>=', '=', '<', '>'] as const
const STOP = /[\s,()'"=<>!]/

/** Reads one quoted text from `at` (the quote); `''` inside single quotes is one quote. */
function quoted(line: string, at: number): { text: string; end: number; open: boolean } {
  const q = line[at] as string
  let text = ''
  let i = at + 1
  while (i < line.length) {
    const ch = line[i] as string
    if (ch === q) {
      if (line[i + 1] === q) {
        text += q
        i += 2
        continue
      }
      return { text, end: i + 1, open: false }
    }
    text += ch
    i++
  }
  return { text, end: i, open: true }
}

/** Words, numbers, `-30d`, dates, quoted text, `( ) ,` and `= != < <= > >=`, each with its line. */
export function tokenize(source: string): Token[] {
  const out: Token[] = []
  source.split('\n').forEach((line, index) => {
    const lineNo = index + 1
    let i = 0
    while (i < line.length) {
      const ch = line[i] as string
      if (/\s/.test(ch)) {
        i++
        continue
      }
      if (ch === '-' && line[i + 1] === '-') break
      if (ch === "'" || ch === '"') {
        const q = quoted(line, i)
        out.push({ text: q.text, upper: '', line: lineNo, kind: 'string', open: q.open })
        i = q.end
        continue
      }
      if (ch === '(' || ch === ')' || ch === ',') {
        out.push({ text: ch, upper: ch, line: lineNo, kind: 'punct' })
        i++
        continue
      }
      const op = OPERATORS.find((o) => line.startsWith(o, i))
      if (op) {
        out.push({ text: op === '<>' ? '!=' : op, upper: op, line: lineNo, kind: 'op' })
        i += op.length
        continue
      }
      let end = i + 1
      while (end < line.length && !STOP.test(line[end] as string)) end++
      // A lone `!` is not an operator: keep it as a word so the parser can point at it.
      const text = line.slice(i, end)
      out.push({ text, upper: text.toUpperCase(), line: lineNo, kind: 'word' })
      i = end
    }
  })
  return out
}

/** Edit distance, for "Did you mean net_sales?". */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0] as number
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j] as number
      row[j] = Math.min(cur + 1, (row[j - 1] as number) + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = cur
    }
  }
  return row[b.length] as number
}

/** The option nearest to `word`, when it is close enough to be a typo. */
export function closest(word: string, options: readonly string[]): string | null {
  let best: string | null = null
  let bestD = Number.POSITIVE_INFINITY
  for (const o of options) {
    const d = distance(word.toLowerCase(), o.toLowerCase())
    if (d < bestD) {
      best = o
      bestD = d
    }
  }
  return best && bestD <= Math.max(2, Math.floor(word.length / 3)) ? best : null
}

export class Problem extends Error {
  constructor(readonly error: QueryError) {
    super(error.message)
  }
}

export function fail(line: number, message: string, suggestion: string | null = null): never {
  throw new Problem({ line, message, suggestion })
}

/** Walks the tokens; `keyword('GROUP BY')` takes both words or neither. */
export class Cursor {
  i = 0
  constructor(readonly tokens: Token[]) {}

  peek(ahead = 0): Token | undefined {
    return this.tokens[this.i + ahead]
  }

  /** The line to blame when something is missing here. */
  line(): number {
    return this.peek()?.line ?? this.tokens.at(-1)?.line ?? 1
  }

  next(what: string): Token {
    const t = this.tokens[this.i++]
    if (!t) return fail(this.tokens.at(-1)?.line ?? 1, `Expected ${what} at the end of the query.`)
    return t
  }

  /** True when the next words are `word` (one or two words, any case), and takes them. */
  keyword(word: string): boolean {
    const parts = word.split(' ')
    for (const [n, part] of parts.entries()) {
      const t = this.peek(n)
      if (t?.kind !== 'word' || t.upper !== part) return false
    }
    this.i += parts.length
    return true
  }

  /** True when the next token is this punctuation or operator, and takes it. */
  symbol(text: string): boolean {
    const t = this.peek()
    if (!t || (t.kind !== 'punct' && t.kind !== 'op') || t.text !== text) return false
    this.i++
    return true
  }
}
