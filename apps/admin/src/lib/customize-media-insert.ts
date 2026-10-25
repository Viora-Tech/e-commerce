/**
 * SOURCE OF TRUTH KEYWORDS: imageTargets, withMedia, mediaTarget, Customize media panel
 * WHAT:  Where a picture from the Media panel lands in a block: its image settings (`{ url,
 *        alt }` object fields, top level or inside list items), and the props with it set.
 * WHY:   Clicking a picture fills the selected block, dropping one on the canvas fills the
 *        block under the pointer; both pick the first empty picture setting, else the first.
 * WHERE: `preview-frame.tsx` (canvas drop).
 */

import type { PuckAction } from '@puckeditor/core'
import type { CustomizeDoc } from './customize-doc'
import { findBlock, locateBlock } from './customize-slots'

export type FieldShape = {
  type?: string
  objectFields?: Record<string, FieldShape>
  arrayFields?: Record<string, FieldShape>
}

export type MediaPick = { url: string; alt: string | null }

/** The drag payload type a Media panel picture carries (JSON `{ url, alt }`). */
export const MEDIA_DRAG_TYPE = 'application/x-customize-media'

type Path = (string | number)[]

/** An image setting: an object field with a picture URL and alt text (`imageField()`). */
const isImageField = (f: FieldShape | undefined): boolean =>
  f?.type === 'object' && Boolean(f.objectFields?.url) && Boolean(f.objectFields?.alt)

const at = (value: unknown, path: Path): unknown =>
  path.reduce<unknown>(
    (v, k) => (v && typeof v === 'object' ? (v as Record<string | number, unknown>)[k] : undefined),
    value,
  )

/** Every picture setting in a block, in field order, with whether it already holds one. */
export function imageTargets(
  fields: Record<string, FieldShape>,
  props: Record<string, unknown>,
): { path: Path; filled: boolean }[] {
  const out: { path: Path; filled: boolean }[] = []
  const visit = (fs: Record<string, FieldShape>, base: Path) => {
    for (const [key, field] of Object.entries(fs)) {
      // Section settings' background picture is a style choice, not the block's picture.
      if (key === 'settings' || key === 'style') continue
      const path = [...base, key]
      if (isImageField(field)) {
        const url = (at(props, path) as { url?: unknown } | undefined)?.url
        out.push({ path, filled: typeof url === 'string' && url !== '' })
      } else if (field.type === 'array' && field.arrayFields) {
        const items = at(props, path)
        if (Array.isArray(items)) {
          for (const i of items.keys()) visit(field.arrayFields, [...path, i])
        }
      }
    }
  }
  visit(fields, [])
  return out
}

/** The picture setting a new picture goes into: the first empty one, else the first. */
export function mediaTarget(
  fields: Record<string, FieldShape>,
  props: Record<string, unknown>,
): Path | null {
  const targets = imageTargets(fields, props)
  return (targets.find((t) => !t.filled) ?? targets[0])?.path ?? null
}

/** The props with the picture set at `path`: alt kept if written, the old focal point dropped. */
export function withMedia(
  props: Record<string, unknown>,
  path: Path,
  media: MediaPick,
): Record<string, unknown> {
  const set = (value: unknown, rest: Path): unknown => {
    if (rest.length === 0) {
      const image = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
      const { focal: _drop, ...keep } = image
      const alt = typeof keep.alt === 'string' && keep.alt !== '' ? keep.alt : (media.alt ?? '')
      return { ...keep, url: media.url, alt }
    }
    const [key, ...tail] = rest as [string | number, ...Path]
    if (Array.isArray(value)) {
      return value.map((item, i) => (i === key ? set(item, tail) : item))
    }
    const object = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
    return { ...object, [key]: set(object[key as string], tail) }
  }
  return set(props, path) as Record<string, unknown>
}

/**
 * The Puck action that puts a picture into a block (by id), or null when the block has no
 * picture setting (a heading, a product grid).
 */
export function mediaAction(
  doc: CustomizeDoc,
  fieldsOf: (type: string) => Record<string, FieldShape> | undefined,
  blockId: string,
  media: MediaPick,
): PuckAction | null {
  const block = findBlock(doc, blockId)
  const located = locateBlock(doc, blockId)
  if (!block || !located) return null
  const props = block.props as Record<string, unknown>
  const path = mediaTarget(fieldsOf(block.type) ?? {}, props)
  if (!path) return null
  return {
    type: 'replace',
    destinationIndex: located.index,
    destinationZone: located.zone,
    data: { ...block, props: withMedia(props, path, media) as typeof block.props },
  }
}
