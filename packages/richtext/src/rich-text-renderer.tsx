import { Fragment, type ReactNode } from 'react'
import { defaultConverters } from './converters'
import type { ConverterRegistry, RichTextRendererProps, SerializedNode } from './types'

function renderNode(
  node: SerializedNode,
  index: number,
  converters: ConverterRegistry,
  context: Record<string, unknown>,
): ReactNode {
  const converter = converters[node.type]
  // Unknown node types (from a newer editor) are skipped rather than crashing the page.
  if (!converter) return null
  const renderChildren = (children?: SerializedNode[]): ReactNode =>
    children?.length ? children.map((child, i) => renderNode(child, i, converters, context)) : null
  const out = converter({ node, renderChildren, context })
  return out == null ? null : <Fragment key={index}>{out}</Fragment>
}

/**
 * Lexical JSON → React. Server-safe; applies no wrapper classes of its own
 * beyond the optional `className`, so the caller controls typography.
 */
export function RichTextRenderer({
  data,
  converters,
  context = {},
  className,
}: RichTextRendererProps) {
  if (!data?.root?.children?.length) return null
  const merged: ConverterRegistry = { ...defaultConverters, ...converters }
  const children = data.root.children.map((node, i) => renderNode(node, i, merged, context))
  return className ? <div className={className}>{children}</div> : children
}
