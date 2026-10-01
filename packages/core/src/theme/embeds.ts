/** SOURCE OF TRUTH: save-time sanitising of Custom HTML in templates. WHAT runs every CustomHtml element's html, at any depth, through the embed allow-list. WHY saved drafts must never hold a script. */
import { sanitizeEmbedHtml } from '@commerce/blocks/embed'
import { isBinding } from '../dynamic-sources/format'
import { mapNestedBlocks } from './nested-blocks'
import type { TemplateData } from './templates-data'

/** Puck types whose `html` prop is merchant HTML. */
const EMBED_TYPES = new Set(['CustomHtml'])

/** Stored `html`, sanitised: a string, or a dynamic-source binding whose typed-in fallback is. */
function sanitizeHtmlProp(html: unknown): unknown {
  if (typeof html === 'string') return sanitizeEmbedHtml(html)
  if (isBinding(html) && html.fallback !== undefined) {
    return { ...html, fallback: sanitizeEmbedHtml(html.fallback) }
  }
  return html
}

/**
 * A template with every Custom HTML element's `html` run through the embed
 * allow-list (`sanitizeEmbedHtml`), wherever it sits: a top-level section, or
 * nested in any slot. Called before a draft is stored, so saved templates
 * never hold a script; the storefront sanitises again when it renders.
 */
export function sanitizeTemplateEmbeds(data: TemplateData): TemplateData {
  return mapNestedBlocks(data, (block) =>
    EMBED_TYPES.has(block.type) && block.props.html !== undefined
      ? { ...block, props: { ...block.props, html: sanitizeHtmlProp(block.props.html) } }
      : block,
  ) as TemplateData
}
