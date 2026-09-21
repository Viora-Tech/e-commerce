import type { ReactNode } from 'react'
import {
  IS_BOLD,
  IS_CODE,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_SUBSCRIPT,
  IS_SUPERSCRIPT,
  IS_UNDERLINE,
} from './types'

/** Wraps a text run in inline elements according to the Lexical format bitmask. */
export function renderText(text: string, format: number): ReactNode {
  if (!format) return text
  let node: ReactNode = text
  if (format & IS_BOLD) node = <strong>{node}</strong>
  if (format & IS_ITALIC) node = <em>{node}</em>
  if (format & IS_UNDERLINE) node = <u>{node}</u>
  if (format & IS_STRIKETHROUGH) node = <s>{node}</s>
  if (format & IS_CODE) node = <code>{node}</code>
  if (format & IS_SUBSCRIPT) node = <sub>{node}</sub>
  if (format & IS_SUPERSCRIPT) node = <sup>{node}</sup>
  return node
}
