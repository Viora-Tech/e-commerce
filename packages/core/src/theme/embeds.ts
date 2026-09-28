/** SOURCE OF TRUTH: save-time sanitising of Custom HTML in templates. WHAT runs every CustomHtml element's html, at any depth, through the embed allow-list. WHY saved drafts must never hold a script. */
import { sanitizeEmbedHtml } from '@commerce/blocks/embed'
import { mapNestedBlocks } from './nested-blocks'
import type { TemplateData } from './templates-data'

/** Puck types whose `html` prop is merchant HTML. */
const EMBED_TYPES = new Set(['CustomHtml'])

/**
 * A template with every Custom HTML element's `html` run through the embed
 * allow-list (`sanitizeEmbedHtml`), wherever it sits: a top-level section, or
 * nested in any slot. Called before a draft is stored, so saved templates
 * never hold a script; the storefront sanitises again when it renders.
 */
export function sanitizeTemplateEmbeds(data: TemplateData): TemplateData {
  return mapNestedBlocks(data, (block) =>
    EMBED_TYPES.has(block.type) && typeof block.props.html === 'string'
      ? { ...block, props: { ...block.props, html: sanitizeEmbedHtml(block.props.html) } }
      : block,
  ) as TemplateData
}
