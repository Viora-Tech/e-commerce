import type { CSSProperties, ElementType, ReactNode } from 'react'

/**
 * A slot as a block's render receives it: in the editor Puck passes its drop
 * zone (`SlotComponent`), on the storefront `renderWithSlots` passes a plain
 * server renderer with the same call shape. Either way the block calls it with
 * the class and style the slot's own element should carry, so the layout is
 * the same in both.
 */
export type SlotRender = (props?: {
  className?: string
  style?: CSSProperties
  minEmptyHeight?: number
  as?: ElementType
}) => ReactNode

/** Stored slot content: the child blocks, each `{ type, props }`. */
export type SlotContent = { type: string; props: Record<string, unknown> }[]

/** A slot prop is a render function at render time; anything else draws nothing. */
export const asSlot = (value: unknown): SlotRender =>
  typeof value === 'function' ? (value as SlotRender) : () => null

/**
 * Only plain site paths, anchors and web, mail or phone links; anything else is dropped.
 * `/\host` is refused like `//host` (browsers read both as another site), and so is any
 * control character (browsers strip tabs and newlines, so `/\t/host` would be `//host`).
 */
export function safeHref(href: unknown): string | null {
  if (typeof href !== 'string') return null
  const h = href.trim()
  // biome-ignore lint/suspicious/noControlCharactersInRegex: refusing control characters is the point.
  if (/[\u0000-\u001f\u007f]/.test(h)) return null
  if (/^\/(?![/\\])/.test(h) || /^#[\w-]*$/.test(h)) return h
  if (/^(https?:\/\/|mailto:|tel:)/i.test(h)) return h
  return null
}

const join = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(' ')

export { join as cx }
