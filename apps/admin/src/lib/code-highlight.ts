import type { CodeLanguage } from '@commerce/core/theme-code'

export type CodeTone = 'plain' | 'muted' | 'string' | 'number' | 'keyword' | 'property'

export type CodeToken = { text: string; tone: CodeTone }

/** One pattern per tone, tried in order at each position; the first match wins. */
type Rule = [RegExp, CodeTone]

const LIQUID: Rule[] = [
  [/{%-?\s*comment\s*-?%}[\s\S]*?{%-?\s*endcomment\s*-?%}/, 'muted'],
  [/({%-?|-?%}|{{-?|-?}})/, 'muted'],
  [/"[^"\n]*"|'[^'\n]*'/, 'string'],
  [/\b\d+(\.\d+)?\b/, 'number'],
  [
    /\b(if|elsif|else|endif|unless|endunless|for|endfor|in|case|when|endcase|assign|capture|endcapture|render|include|section|schema|endschema|form|endform|paginate|endpaginate|liquid|echo|style|endstyle|javascript|endjavascript|stylesheet|endstylesheet|limit|offset|and|or|contains|true|false|nil|blank|empty)\b/,
    'keyword',
  ],
  [/<\/?[a-zA-Z][\w-]*|\/?>/, 'property'],
]

const JSON_RULES: Rule[] = [
  [/\/\*[\s\S]*?\*\/|\/\/[^\n]*/, 'muted'],
  [/"(?:[^"\\\n]|\\.)*"(?=\s*:)/, 'property'],
  [/"(?:[^"\\\n]|\\.)*"/, 'string'],
  [/-?\d+(\.\d+)?([eE][+-]?\d+)?/, 'number'],
  [/\b(true|false|null)\b/, 'keyword'],
]

const CSS_RULES: Rule[] = [
  [/\/\*[\s\S]*?\*\//, 'muted'],
  [/"[^"\n]*"|'[^'\n]*'/, 'string'],
  [/#[0-9a-fA-F]{3,8}\b|-?\d+(\.\d+)?(px|rem|em|%|ms|s|vh|vw|fr)?/, 'number'],
  [/--?[a-zA-Z][\w-]*(?=\s*:)|[a-zA-Z-]+(?=\s*:)/, 'property'],
  [/@[\w-]+/, 'keyword'],
]

const JS_RULES: Rule[] = [
  [/\/\*[\s\S]*?\*\/|\/\/[^\n]*/, 'muted'],
  [/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/, 'string'],
  [/\b\d+(\.\d+)?\b/, 'number'],
  [
    /\b(const|let|var|function|return|if|else|for|while|of|in|new|class|import|export|from|async|await|this|true|false|null|undefined)\b/,
    'keyword',
  ],
]

const RULES: Partial<Record<CodeLanguage, Rule[]>> = {
  liquid: LIQUID,
  svg: LIQUID,
  json: JSON_RULES,
  css: CSS_RULES,
  js: JS_RULES,
}

/**
 * Light colouring for the editor's backdrop: comments and Liquid delimiters dim, strings,
 * numbers, keywords and property names in their own tone. Tokens never span a line, so the
 * editor can draw one row per line. Plain text passes through as one token per line.
 */
export function highlightLines(text: string, language: CodeLanguage): CodeToken[][] {
  const rules = RULES[language]
  const lines: CodeToken[][] = [[]]
  const push = (chunk: string, tone: CodeTone) => {
    const parts = chunk.split('\n')
    parts.forEach((part, i) => {
      if (i > 0) lines.push([])
      if (part) lines.at(-1)?.push({ text: part, tone })
    })
  }
  if (!rules) {
    push(text, 'plain')
    return lines
  }
  // Sticky copies: each rule is tried exactly at the current position, never searched ahead.
  const sticky = rules.map(([re, tone]) => [new RegExp(re.source, 'y'), tone] as const)
  const word = /[\w-]+|[\s\S]/y
  let plain = ''
  let at = 0
  while (at < text.length) {
    let matched = false
    for (const [re, tone] of sticky) {
      re.lastIndex = at
      const m = re.exec(text)
      if (m?.[0]) {
        if (plain) push(plain, 'plain')
        plain = ''
        push(m[0], tone)
        at += m[0].length
        matched = true
        break
      }
    }
    if (!matched) {
      // Words go through whole, so a keyword is never matched inside a longer name.
      word.lastIndex = at
      const w = word.exec(text)?.[0] ?? text.charAt(at)
      plain += w
      at += w.length
    }
  }
  if (plain) push(plain, 'plain')
  return lines
}
