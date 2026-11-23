import type { EmailBlock } from '../emails/blocks'
import type { ButtonLook } from '../emails/components'
import type { TemplateData } from '../types'
import { BUTTON_RADIUS, type ButtonStyle, type SlotEdit } from './style-types'
import { fillVariables } from './variables'

/**
 * A merchant's edits laid over one of the order's own blocks: their words (variables filled
 * from this order) over the built-in words, the parts they switched off, their colours. The
 * order's data (lines, totals, codes, the route) is never replaced. Pure.
 */

/** The button's look: the email's button style, then the block's own. */
export function buttonLook(
  base: ButtonStyle | undefined,
  own: ButtonStyle | undefined,
  align?: 'left' | 'center' | 'right' | undefined,
): ButtonLook | undefined {
  const s = { ...base, ...own }
  if (!s.background && !s.text && !s.shape && !s.full && !align) return undefined
  return {
    background: s.background,
    text: s.text,
    radius: s.shape ? BUTTON_RADIUS[s.shape] : undefined,
    full: s.full,
    align,
  }
}

export type EditedSlot = { block: EmailBlock; accent?: string | undefined }

export function applySlotEdit(
  block: EmailBlock,
  edit: SlotEdit | undefined,
  d: TemplateData,
  buttons?: ButtonStyle | undefined,
): EditedSlot {
  const text = (k: string, fallback: string): string => {
    const own = edit?.texts?.[k]
    const filled = own ? fillVariables(own, d).trim() : ''
    return filled || fallback
  }
  const optText = (k: string, fallback: string | undefined): string | undefined => {
    const own = edit?.texts?.[k]
    const filled = own ? fillVariables(own, d).trim() : ''
    return filled || fallback
  }
  const ink = edit?.colours?.ink
  switch (block.kind) {
    case 'items':
      return {
        block: {
          ...block,
          title: text('title', block.title),
          totalHeading: text('totalHeading', block.totalHeading),
          look: { hide: edit?.hide, ink, line: edit?.colours?.line },
        },
      }
    case 'status':
    case 'notice':
      return {
        block: {
          ...block,
          title: text('title', block.title),
          body: optText('body', block.body),
          colours: ink || edit?.colours?.bg ? { ink, bg: edit?.colours?.bg } : undefined,
        },
      }
    case 'button':
      return {
        block: {
          ...block,
          label: text('label', block.label),
          secondary: edit?.hide?.includes('secondary') ? undefined : block.secondary,
          look: buttonLook(buttons, edit?.button),
        },
      }
    case 'coupon':
      return {
        block: { ...block, label: text('label', block.label), note: optText('note', block.note) },
        accent: ink,
      }
    case 'divider':
      return { block: { ...block, label: text('label', block.label) } }
    case 'text':
      return { block: { ...block, text: text('text', block.text) } }
    case 'quote':
      return { block: { ...block, label: text('label', block.label) }, accent: ink }
    case 'code':
    case 'ticket':
      return { block, accent: ink }
    default:
      return { block }
  }
}
