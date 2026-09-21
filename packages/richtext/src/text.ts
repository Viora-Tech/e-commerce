import type { RichTextValue, SerializedNode } from './types'

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'quote',
  'listitem',
  'tablerow',
  'code',
  'collapsible-title',
  'collapsible-content',
])

function collect(node: SerializedNode, out: string[]): void {
  if (typeof node.text === 'string') out.push(node.text)
  if (node.type === 'linebreak') out.push('\n')
  for (const child of node.children ?? []) collect(child, out)
  if (BLOCK_TYPES.has(node.type)) out.push('\n')
}

/** Plain text with block boundaries as newlines. Used for SEO descriptions and search. */
export function richTextToPlainText(value: RichTextValue | null | undefined): string {
  if (!value?.root) return ''
  const out: string[] = []
  collect(value.root, out)
  return out
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

/** True when the document has no text, media or embeds. */
export function isRichTextEmpty(value: RichTextValue | null | undefined): boolean {
  if (!value?.root?.children?.length) return true
  const hasContent = (node: SerializedNode): boolean =>
    (typeof node.text === 'string' && node.text.trim() !== '') ||
    node.type === 'image' ||
    node.type === 'youtube' ||
    node.type === 'horizontalrule' ||
    (node.children ?? []).some(hasContent)
  return !value.root.children.some(hasContent)
}

/** A document with one empty paragraph: what a fresh editor holds. */
export function emptyRichText(): RichTextValue {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: null,
      children: [
        {
          type: 'paragraph',
          format: '',
          indent: 0,
          version: 1,
          direction: null,
          children: [],
          textFormat: 0,
          textStyle: '',
        },
      ],
    },
  }
}

/** Parse a stored value that may be a JSON string, an object, or legacy plain text. */
export function parseRichText(raw: unknown): RichTextValue | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'object' && raw !== null && 'root' in raw) return raw as RichTextValue
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      return parsed && typeof parsed === 'object' && 'root' in parsed
        ? (parsed as RichTextValue)
        : null
    } catch {
      return null
    }
  }
  return plainTextToRichText(trimmed)
}

/** Legacy string content → one paragraph per line. */
export function plainTextToRichText(text: string): RichTextValue {
  const paragraphs = text.split(/\r?\n/).map((line) => ({
    type: 'paragraph',
    format: '',
    indent: 0,
    version: 1,
    direction: null,
    textFormat: 0,
    textStyle: '',
    children: line
      ? [{ type: 'text', text: line, format: 0, detail: 0, mode: 'normal', style: '', version: 1 }]
      : [],
  }))
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: null,
      children: paragraphs,
    },
  }
}
