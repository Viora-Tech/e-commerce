import { composeEmail } from '../templates/compose'
import { designableTemplate } from '../templates/internal'
import type { TemplateData, TemplateId } from '../types'
import { composedBlocks } from './default-design'
import { parseEmailDesign } from './parse'
import { type ResolvedBlock, resolveDesign } from './resolve'
import type { DesignStyles } from './style-types'

/**
 * The saved design to draw this message with, laid over its real data, or null for the
 * built-in email: no design, a template that cannot be designed (team reports, platform mail),
 * or a design that does not parse (logged, then the built-in email goes out instead).
 */
export function designFor(
  template: TemplateId,
  d: TemplateData,
): {
  subject?: string | undefined
  styles?: DesignStyles | undefined
  blocks: ResolvedBlock[]
} | null {
  if (d.design === undefined || d.design === null) return null
  if (!designableTemplate(template) || d.report) return null
  if (!composeEmail(template, d)) return null
  const design = parseEmailDesign(d.design)
  if (!design) {
    console.warn('saved email design is not valid; sending the built-in email', { template })
    return null
  }
  return {
    subject: design.subject,
    styles: design.styles,
    blocks: resolveDesign(design, composedBlocks(template, d)),
  }
}
