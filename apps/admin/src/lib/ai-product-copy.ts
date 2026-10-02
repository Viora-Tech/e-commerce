/**
 * Turns "Write with AI" suggestions into product form values: the description as the
 * editor's rich text (built by @commerce/ai's `descriptionFromCopy`, shared with the assistant
 * and the bulk writer), and tags merged into the existing ones. Pure and unit tested.
 */
import {
  appendSpecs as appendCopySpecs,
  descriptionFromCopy as copyDescription,
  newTags,
  type ProductCopy,
} from '@commerce/ai/client'
import type { RichTextValue } from '@commerce/richtext'

export type ApplyPicks = {
  description: boolean
  specs: boolean
  seoTitle: boolean
  seoDescription: boolean
  tags: boolean
}

export { newTags }

/** The suggested description, with the specs list at the end when `withSpecs`. */
export function descriptionFromCopy(copy: ProductCopy, withSpecs: boolean): RichTextValue {
  return copyDescription(copy, withSpecs) as RichTextValue
}

/** The current description with only the specs list added at the end. */
export function appendSpecs(current: RichTextValue | null, copy: ProductCopy): RichTextValue {
  return appendCopySpecs(current, copy) as RichTextValue
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
