/**
 * Turns "Write with AI" suggestions into product form values: the description as the
 * editor's rich text (intro, bullet highlights, closing line, optional specs list), and tags
 * merged into the existing ones. Pure, so the preview and Apply agree and it is unit tested.
 */
import type { ProductCopy } from '@commerce/ai/client'
import { IS_BOLD, type RichTextValue, type SerializedNode } from '@commerce/richtext'

export type ApplyPicks = {
  description: boolean
  specs: boolean
  seoTitle: boolean
  seoDescription: boolean
  tags: boolean
}

const block = (type: string, children: SerializedNode[], extra: Record<string, unknown> = {}) =>
  ({
    type,
    format: '',
    indent: 0,
    version: 1,
    direction: null,
    children,
    ...extra,
  }) as SerializedNode

const text = (value: string, format = 0) =>
  ({
    type: 'text',
    text: value,
    format,
    detail: 0,
    mode: 'normal',
    style: '',
    version: 1,
  }) as SerializedNode

const paragraph = (value: string) =>
  block('paragraph', [text(value)], { textFormat: 0, textStyle: '' })

const bulletList = (items: SerializedNode[][]) =>
  block(
    'list',
    items.map((children, i) => block('listitem', children, { value: i + 1 })),
    { listType: 'bullet', start: 1, tag: 'ul' },
  )

function specsNodes(copy: ProductCopy): SerializedNode[] {
  if (!copy.specs.length) return []
  return [
    block('heading', [text(copy.specsTitle || 'Key specs')], { tag: 'h3' }),
    bulletList(copy.specs.map((s) => [text(`${s.label}: `, IS_BOLD), text(s.value)])),
  ]
}

function root(children: SerializedNode[]): RichTextValue {
  return { root: block('root', children) }
}

/** The suggested description, with the specs list at the end when `withSpecs`. */
export function descriptionFromCopy(copy: ProductCopy, withSpecs: boolean): RichTextValue {
  return root([
    ...(copy.intro ? [paragraph(copy.intro)] : []),
    ...(copy.highlights.length ? [bulletList(copy.highlights.map((h) => [text(h)]))] : []),
    ...(copy.closing ? [paragraph(copy.closing)] : []),
    ...(withSpecs ? specsNodes(copy) : []),
  ])
}

/** The current description with only the specs list added at the end. */
export function appendSpecs(current: RichTextValue | null, copy: ProductCopy): RichTextValue {
  const existing = current?.root.children ?? []
  return root([...existing, ...specsNodes(copy)])
}

/** Tags the suggestion adds that the product does not have yet (case-insensitive). */
export function newTags(current: string[], suggested: string[]): string[] {
  const have = new Set(current.map((t) => t.trim().toLowerCase()))
  return suggested.filter((t) => !have.has(t.trim().toLowerCase()))
}

export type CopyPatch = {
  description?: RichTextValue
  seoTitle?: string
  seoDescription?: string
  tags?: string[]
}

/** The form patch for the parts the merchant ticked. Nothing ticked: an empty patch. */
export function patchFromCopy(
  copy: ProductCopy,
  picks: ApplyPicks,
  current: { description: RichTextValue | null; tags: string[] },
): CopyPatch {
  const patch: CopyPatch = {}
  if (picks.description) patch.description = descriptionFromCopy(copy, picks.specs)
  else if (picks.specs && copy.specs.length)
    patch.description = appendSpecs(current.description, copy)
  if (picks.seoTitle && copy.seoTitle) patch.seoTitle = copy.seoTitle
  if (picks.seoDescription && copy.seoDescription) patch.seoDescription = copy.seoDescription
  if (picks.tags) patch.tags = [...current.tags, ...newTags(current.tags, copy.tags)]
  return patch
}
