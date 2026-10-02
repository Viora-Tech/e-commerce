/**
 * SOURCE OF TRUTH: product copy as the editor's rich text — WHAT turns the writer's output
 * (intro, highlights, closing, specs) into a Lexical document and merges suggested tags /
 * WHY the product page's Apply, the AI assistant and the bulk writer all produce the same
 * description. Pure and client-safe: plain Lexical JSON, no editor or React import.
 */
import type { ProductCopy } from './schema'

/** A Lexical node, structurally the same as `SerializedNode` in @commerce/richtext. */
export type CopyNode = { type: string; children?: CopyNode[]; [key: string]: unknown }
export type CopyDoc = { root: CopyNode }

/** Lexical's bold text format flag (`IS_BOLD` in @commerce/richtext). */
const BOLD = 1

const block = (type: string, children: CopyNode[], extra: Record<string, unknown> = {}) =>
  ({
    type,
    format: '',
    indent: 0,
    version: 1,
    direction: null,
    children,
    ...extra,
  }) as CopyNode

const text = (value: string, format = 0) =>
  ({
    type: 'text',
    text: value,
    format,
    detail: 0,
    mode: 'normal',
    style: '',
    version: 1,
  }) as CopyNode

const paragraph = (value: string) =>
  block('paragraph', [text(value)], { textFormat: 0, textStyle: '' })

const bulletList = (items: CopyNode[][]) =>
  block(
    'list',
    items.map((children, i) => block('listitem', children, { value: i + 1 })),
    { listType: 'bullet', start: 1, tag: 'ul' },
  )

function specsNodes(copy: ProductCopy): CopyNode[] {
  if (!copy.specs.length) return []
  return [
    block('heading', [text(copy.specsTitle || 'Key specs')], { tag: 'h3' }),
    bulletList(copy.specs.map((s) => [text(`${s.label}: `, BOLD), text(s.value)])),
  ]
}

function root(children: CopyNode[]): CopyDoc {
  return { root: block('root', children) }
}

/** The suggested description, with the specs list at the end when `withSpecs`. */
export function descriptionFromCopy(copy: ProductCopy, withSpecs: boolean): CopyDoc {
  return root([
    ...(copy.intro ? [paragraph(copy.intro)] : []),
    ...(copy.highlights.length ? [bulletList(copy.highlights.map((h) => [text(h)]))] : []),
    ...(copy.closing ? [paragraph(copy.closing)] : []),
    ...(withSpecs ? specsNodes(copy) : []),
  ])
}

/** The current description with only the specs list added at the end. */
export function appendSpecs(current: CopyDoc | null, copy: ProductCopy): CopyDoc {
  const existing = current?.root.children ?? []
  return root([...existing, ...specsNodes(copy)])
}

/** A plain description: paragraphs split on blank lines, `- ` lines as a bullet list. */
export function descriptionFromText(value: string): CopyDoc {
  const nodes: CopyNode[] = []
  for (const chunk of value.split(/\n\s*\n/)) {
    const lines = chunk
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (!lines.length) continue
    const bullets = lines.filter((l) => /^[-•*]\s+/.test(l))
    if (bullets.length === lines.length) {
      nodes.push(bulletList(bullets.map((l) => [text(l.replace(/^[-•*]\s+/, ''))])))
    } else nodes.push(paragraph(lines.join(' ')))
  }
  return root(nodes)
}

const BLOCKS = new Set(['paragraph', 'heading', 'listitem', 'quote'])

/**
 * A stored description (Lexical JSON, or a legacy plain string) as plain text: one line per
 * paragraph, heading or list item. For prompts; the admin uses @commerce/richtext instead.
 */
export function descriptionText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  const lines: string[] = []
  const walk = (node: CopyNode | undefined, line: string[]): void => {
    if (!node) return
    if (node.type === 'text' && typeof node.text === 'string') line.push(node.text)
    if (node.type === 'linebreak') line.push(' ')
    for (const child of node.children ?? []) {
      if (BLOCKS.has(child.type)) {
        const own: string[] = []
        walk(child, own)
        const text = own.join('').trim()
        if (text) lines.push(child.type === 'listitem' ? `- ${text}` : text)
      } else walk(child, line)
    }
  }
  const root = (value as CopyDoc | null)?.root
  if (!root || typeof root !== 'object') return ''
  const loose: string[] = []
  walk(root, loose)
  if (loose.join('').trim()) lines.unshift(loose.join('').trim())
  return lines.join('\n')
}

/** Tags the suggestion adds that the product does not have yet (case-insensitive). */
export function newTags(current: string[], suggested: string[]): string[] {
  const have = new Set(current.map((t) => t.trim().toLowerCase()))
  return suggested.filter((t) => !have.has(t.trim().toLowerCase()))
}
