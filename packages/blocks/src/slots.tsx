import type { ComponentConfig } from '@puckeditor/core'
import { createElement, type ElementType, type ReactNode } from 'react'
import type { SlotContent, SlotRender } from './slot-types'

/**
 * Server rendering for Puck slots outside `<Render>`. The storefront draws each
 * template section itself (`renderTemplate`), so a section's slot props arrive
 * as stored content (`[{ type, props }]`). `withServerSlots` swaps each for a
 * render function with the same call shape Puck's editor passes (class, style,
 * element), which draws the children, recursively, with their own slots.
 * Hidden children (`_hidden`, the editor's eye) are skipped, as top-level
 * sections are.
 */

type FieldShape = {
  type?: string
  arrayFields?: Record<string, FieldShape>
  objectFields?: Record<string, FieldShape>
}
type Components = Record<string, ComponentConfig | undefined>
type Item = { type: string; props: Record<string, unknown> }

/** Whether a stored block is switched off with the editor's eye. */
export const isHiddenBlock = (item: { props?: Record<string, unknown> }): boolean =>
  item.props?._hidden === true

function mapSlots(
  value: unknown,
  field: FieldShape | undefined,
  toSlot: (content: SlotContent) => SlotRender,
): unknown {
  if (!field) return value
  if (field.type === 'slot') return toSlot(Array.isArray(value) ? (value as SlotContent) : [])
  if (field.type === 'array' && Array.isArray(value) && field.arrayFields) {
    return value.map((item) => mapFields(item, field.arrayFields ?? {}, toSlot))
  }
  if (field.type === 'object' && value && typeof value === 'object' && field.objectFields) {
    return mapFields(value, field.objectFields, toSlot)
  }
  return value
}

function mapFields(
  value: unknown,
  fields: Record<string, FieldShape>,
  toSlot: (content: SlotContent) => SlotRender,
): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const out: Record<string, unknown> = { ...(value as Record<string, unknown>) }
  for (const [key, field] of Object.entries(fields)) {
    if (field?.type === 'slot' || key in out) out[key] = mapSlots(out[key], field, toSlot)
  }
  return out
}

/** Props with every slot (top level, in array items, in objects) as a server renderer. */
export function withServerSlots(
  props: Record<string, unknown>,
  fields: Record<string, unknown> | undefined,
  renderChild: (item: Item) => ReactNode,
): Record<string, unknown> {
  const toSlot =
    (content: SlotContent): SlotRender =>
    (opts = {}) =>
      createElement(
        (opts.as ?? 'div') as ElementType,
        { className: opts.className, style: opts.style },
        ...content.filter((c) => !isHiddenBlock(c)).map((c) => renderChild(c)),
      )
  return mapFields(props, (fields ?? {}) as Record<string, FieldShape>, toSlot) as Record<
    string,
    unknown
  >
}

/**
 * One stored block drawn on the server with its defaults, the render context
 * (`puck`) and its slots filled, children included. Null for an unknown type
 * or a hidden block.
 */
export function renderBlock(
  item: Item,
  components: Components,
  puck: Record<string, unknown>,
): ReactNode {
  const config = components[item.type]
  if (!config?.render || isHiddenBlock(item)) return null
  const props = withServerSlots(
    { ...(config.defaultProps as Record<string, unknown> | undefined), ...item.props },
    config.fields as Record<string, unknown> | undefined,
    (child) => renderBlock(child, components, puck),
  )
  const Render = config.render as unknown as (p: Record<string, unknown>) => ReactNode
  return createElement(Render, { key: String(item.props.id ?? ''), ...props, puck })
}
