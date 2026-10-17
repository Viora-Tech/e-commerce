import type { StatusTone } from '@/data/status'

export type ChipTone = 'neutral' | 'attention' | 'info' | 'danger' | 'success' | 'violet'

/** The one policy: a status meaning becomes a chip tone here and nowhere else. */
const TONE_FOR: Record<StatusTone, ChipTone> = {
  success: 'success',
  pending: 'attention',
  error: 'danger',
  info: 'info',
  accent: 'violet',
  neutral: 'neutral',
}

export function toneFor(tone: StatusTone): ChipTone {
  return TONE_FOR[tone]
}

/** Soft chip (Figma "Badge"): a soft fill, a matching border and the strong text colour. */
export const CHIP_SOFT: Record<ChipTone, string> = {
  neutral: 'border-neutral-border bg-neutral-soft text-neutral',
  attention: 'border-warning-border bg-warning-soft text-warning',
  info: 'border-info-border bg-info-soft text-info',
  danger: 'border-danger-border bg-danger-soft text-danger',
  success: 'border-success-border bg-success-soft text-success',
  violet: 'border-violet-border bg-violet-soft text-violet',
}

/** Outline chip: the same border and text, no fill. */
export const CHIP_OUTLINE: Record<ChipTone, string> = {
  neutral: 'border-neutral-border text-neutral',
  attention: 'border-warning-border text-warning',
  info: 'border-info-border text-info',
  danger: 'border-danger-border text-danger',
  success: 'border-success-border text-success',
  violet: 'border-violet-border text-violet',
}

/** Plain coloured text, for inline status words and glyph labels. */
export const CHIP_TEXT: Record<ChipTone, string> = {
  neutral: 'text-neutral',
  attention: 'text-warning',
  info: 'text-info',
  danger: 'text-danger',
  success: 'text-success',
  violet: 'text-violet',
}

/** The dot colour on its own. */
export const CHIP_DOT: Record<ChipTone, string> = {
  neutral: 'bg-neutral',
  attention: 'bg-warning',
  info: 'bg-info',
  danger: 'bg-danger',
  success: 'bg-success',
  violet: 'bg-violet',
}
