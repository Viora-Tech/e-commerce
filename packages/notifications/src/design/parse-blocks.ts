import { align, hex, isObj, parseBox, parseButtonStyle, parseSlotEdit, str } from './parse-style'
import { sanitizeEmailHtml } from './sanitize-html'
import { SLOT_KEY, slotKind } from './slots'
import {
  CELL_BLOCK_TYPES,
  type CellBlock,
  type DesignBlock,
  DESIGN_LIMITS as L,
  type ProductItem,
} from './types'
import { fillForCheck } from './variable-syntax'

/** One stored block, read the way every send reads it: a bad block is null, never a throw. */

/** A link a shopper may click: http(s) or mailto, variables allowed (`{{order_url}}`). */
export function isSafeLink(url: string): boolean {
  const u = fillForCheck(url.trim())
  return /^(https?:\/\/[^\s"'<>]+|mailto:[^\s"'<>]+)$/i.test(u)
}

/** An image address: https, or the store's own media path (`/media/...`). */
export function isSafeImage(src: string): boolean {
  return /^https:\/\/[^\s"'<>]+$/i.test(src) || /^\/[a-z0-9][^\s"'<>]*$/i.test(src)
}

const HANDLE = /^[a-z0-9][a-z0-9-]{0,200}$/i

function parseProduct(v: unknown): ProductItem | null {
  if (!isObj(v)) return null
  const id = str(v.id, L.id * 2)
  const handle = str(v.handle, 200)
  const title = str(v.title, L.label)
  if (!id || !handle || !HANDLE.test(handle) || !title) return null
  const img = str(v.imageUrl, L.url)
  return {
    id,
    handle,
    title,
    priceLabel: str(v.priceLabel, 40) ?? '',
    imageUrl: img && isSafeImage(img) ? img : undefined,
  }
}

const cellType = (t: unknown): t is CellBlock['type'] =>
  (CELL_BLOCK_TYPES as readonly unknown[]).includes(t)

export function parseBlock(b: unknown, depth = 0): DesignBlock | null {
  if (!isObj(b)) return null
  const id = str(b.id, L.id)
  if (!id) return null
  const block = parseBare(b, id, depth)
  if (!block) return null
  const box = parseBox(b.box)
  return box ? { ...block, box } : block
}

function parseBare(b: Record<string, unknown>, id: string, depth: number): DesignBlock | null {
  const text = (k: string, max: number = L.text) => str(b[k], max) ?? ''
  const optLink = (k: string) => {
    const v = str(b[k], L.url)?.trim()
    return v && isSafeLink(v) ? v : undefined
  }
  switch (b.type) {
    case 'intro':
      return {
        id,
        type: 'intro',
        eyebrow: str(b.eyebrow, L.label),
        heading: str(b.heading, L.label),
        lead: str(b.lead, L.text),
        ...(align(b.align) ? { align: align(b.align) } : {}),
      }
    case 'slot': {
      const slot = str(b.slot, 30)
      if (!slot || !SLOT_KEY.test(slot)) return null
      const edit = parseSlotEdit(slotKind(slot), b.edit, L.text)
      return edit ? { id, type: 'slot', slot, edit } : { id, type: 'slot', slot }
    }
    case 'logo':
      return { id, type: 'logo', menu: b.menu !== false }
    case 'heading':
      return {
        id,
        type: 'heading',
        text: text('text', L.label),
        size: b.size === 'small' ? 'small' : 'large',
        ...(hex(b.colour) ? { colour: hex(b.colour) } : {}),
      }
    case 'text':
      return {
        id,
        type: 'text',
        text: text('text'),
        align: b.align === 'left' ? 'left' : 'center',
        muted: b.muted === true,
        ...(b.rich === true ? { rich: true } : {}),
        ...(hex(b.colour) ? { colour: hex(b.colour) } : {}),
      }
    case 'image': {
      const src = text('src', L.url)
      if (!isSafeImage(src)) return null
      const width = typeof b.width === 'number' && Number.isFinite(b.width) ? b.width : 100
      return {
        id,
        type: 'image',
        src,
        alt: text('alt', L.label),
        href: optLink('href'),
        width: Math.min(100, Math.max(20, Math.round(width))),
      }
    }
    case 'button': {
      const url = text('url', L.url)
      const label = text('label', L.label)
      if (!label || !isSafeLink(url)) return null
      const style = parseButtonStyle(b.style)
      return { id, type: 'button', label, url, ...(style ? { style } : {}) }
    }
    case 'divider':
      return {
        id,
        type: 'divider',
        label: text('label', L.label),
        ...(hex(b.colour) ? { colour: hex(b.colour) } : {}),
      }
    case 'spacer':
      return {
        id,
        type: 'spacer',
        size: b.size === 'small' || b.size === 'large' ? b.size : 'medium',
      }
    case 'social':
      return { id, type: 'social' }
    case 'help': {
      const title = str(b.title, L.label)
      const body = str(b.body, L.text)
      return {
        id,
        type: 'help',
        ...(title ? { title } : {}),
        ...(body ? { body } : {}),
        ...(b.whatsapp === false ? { whatsapp: false } : {}),
      }
    }
    case 'footer': {
      const note = str(b.note, L.text)
      const links = Array.isArray(b.links)
        ? b.links
            .filter(isObj)
            .map((l) => ({
              label: str(l.label, L.label)?.trim() ?? '',
              url: str(l.url, L.url)?.trim() ?? '',
            }))
            .filter((l) => l.label && isSafeLink(l.url))
            .slice(0, L.links)
        : []
      return {
        id,
        type: 'footer',
        social: b.social !== false,
        ...(note ? { note } : {}),
        ...(b.address === false ? { address: false } : {}),
        ...(links.length > 0 ? { links } : {}),
      }
    }
    case 'hero': {
      const src = text('src', L.url)
      if (!isSafeImage(src)) return null
      const buttonUrl = text('buttonUrl', L.url)
      return {
        id,
        type: 'hero',
        src,
        alt: text('alt', L.label),
        href: optLink('href'),
        heading: text('heading', L.label),
        text: text('text'),
        buttonLabel: text('buttonLabel', L.label),
        buttonUrl: isSafeLink(buttonUrl) ? buttonUrl : '',
      }
    }
    case 'products': {
      const items = Array.isArray(b.items)
        ? b.items
            .map(parseProduct)
            .filter((p): p is ProductItem => p !== null)
            .slice(0, L.products)
        : []
      return {
        id,
        type: 'products',
        title: text('title', L.label),
        items,
        columns: b.columns === 2 ? 2 : 3,
        showPrice: b.showPrice !== false,
        buttonLabel: text('buttonLabel', L.label),
      }
    }
    case 'coupon': {
      const code = text('code', 60).trim()
      if (!code) return null
      return {
        id,
        type: 'coupon',
        code,
        label: text('label', L.label),
        note: text('note', L.label),
        value: text('value', 20),
        valueNote: text('valueNote', 30),
      }
    }
    case 'video': {
      const src = text('src', L.url)
      const url = text('url', L.url)
      if (!isSafeImage(src) || !isSafeLink(url)) return null
      return {
        id,
        type: 'video',
        src,
        url,
        alt: text('alt', L.label),
        label: text('label', L.label),
      }
    }
    case 'html':
      return { id, type: 'html', html: sanitizeEmailHtml(text('html', L.html)) }
    case 'columns': {
      if (depth > 0 || !Array.isArray(b.cells)) return null
      const cells = b.cells.slice(0, 3).map((cell) =>
        Array.isArray(cell)
          ? cell
              .slice(0, L.cell)
              .filter((c) => isObj(c) && cellType(c.type))
              .map((c) => parseBlock(c, depth + 1) as CellBlock | null)
              .filter((c): c is CellBlock => c !== null)
          : [],
      )
      if (cells.length === 0) return null
      return {
        id,
        type: 'columns',
        cells,
        stack: b.stack !== false,
        ...(b.valign === 'middle' ? { valign: 'middle' as const } : {}),
        ...(b.gap === 'small' ? { gap: 'small' as const } : {}),
      }
    }
    default:
      return null
  }
}
