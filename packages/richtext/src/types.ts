import type { ReactNode } from 'react'

/** Loose serialized Lexical node. Covers the standard nodes plus our custom ones. */
export type SerializedNode = {
  type: string
  children?: SerializedNode[]
  /** Text nodes carry a numeric bitmask; element nodes a string such as "center". */
  format?: number | string
  indent?: number
  direction?: 'ltr' | 'rtl' | null
  [k: string]: unknown
}

/** What the editor stores and the renderer reads. */
export type RichTextValue = { root: SerializedNode }

export type RenderChildren = (children?: SerializedNode[]) => ReactNode

export type NodeConverterProps = {
  node: SerializedNode
  renderChildren: RenderChildren
  context: Record<string, unknown>
}

export type NodeConverter = (props: NodeConverterProps) => ReactNode

export type ConverterRegistry = Record<string, NodeConverter>

export type RichTextRendererProps = {
  data: RichTextValue | null | undefined
  /** Override or extend the built-in converters, keyed by node type. */
  converters?: ConverterRegistry | undefined
  context?: Record<string, unknown> | undefined
  className?: string | undefined
}

// Text format bitmask (Lexical spec)
export const IS_BOLD = 1
export const IS_ITALIC = 2
export const IS_STRIKETHROUGH = 4
export const IS_UNDERLINE = 8
export const IS_CODE = 16
export const IS_SUBSCRIPT = 32
export const IS_SUPERSCRIPT = 64
