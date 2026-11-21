import { SLOT_KEY } from './slots'
import {
  DESIGN_VERSION,
  type DesignBlock,
  type EmailTemplateDesign,
  DESIGN_LIMITS as L,
} from './types'
import { fillForCheck } from './variable-syntax'

/**
 * The send-time reading of a stored design. The API validates on save (core
 * `EmailTemplateDesignSchema`); this runs again on every send because a stored row can be old,
 * hand-edited or broken. Null for anything that is not a design; a single bad block is dropped.
 */

type Raw = Record<string, unknown>

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Control characters other than tab and newline never belong in an email's words. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined
  return v.replace(CONTROL, '').slice(0, max)
}

/** A link a shopper may click: http(s) or mailto, variables allowed (`{{order_url}}`). */
export function isSafeLink(url: string): boolean {
  const u = fillForCheck(url.trim())
  return /^(https?:\/\/[^\s"'<>]+|mailto:[^\s"'<>]+)$/i.test(u)
}

/** An image address: https, or the store's own media path (`/media/...`). */
export function isSafeImage(src: string): boolean {
  return /^https:\/\/[^\s"'<>]+$/i.test(src) || /^\/[a-z0-9][^\s"'<>]*$/i.test(src)
}

function parseBlock(b: unknown): DesignBlock | null {
  if (!isObj(b)) return null
  const id = str(b.id, L.id)
  if (!id) return null
  const text = (k: string, max: number = L.text) => str(b[k], max) ?? ''
  switch (b.type) {
    case 'intro':
      return {
        id,
        type: 'intro',
        eyebrow: str(b.eyebrow, L.label),
        heading: str(b.heading, L.label),
        lead: str(b.lead, L.text),
      }
    case 'slot': {
      const slot = str(b.slot, 30)
      return slot && SLOT_KEY.test(slot) ? { id, type: 'slot', slot } : null
    }
    case 'logo':
      return { id, type: 'logo', menu: b.menu !== false }
    case 'heading':
      return {
        id,
        type: 'heading',
        text: text('text', L.label),
        size: b.size === 'small' ? 'small' : 'large',
      }
    case 'text':
      return {
        id,
        type: 'text',
        text: text('text'),
        align: b.align === 'left' ? 'left' : 'center',
        muted: b.muted === true,
      }
    case 'image': {
      const src = text('src', L.url)
      if (!isSafeImage(src)) return null
      const href = str(b.href, L.url)
      const width = typeof b.width === 'number' && Number.isFinite(b.width) ? b.width : 100
      return {
        id,
        type: 'image',
        src,
        alt: text('alt', L.label),
        href: href && isSafeLink(href) ? href : undefined,
        width: Math.min(100, Math.max(20, Math.round(width))),
      }
    }
    case 'button': {
      const url = text('url', L.url)
      const label = text('label', L.label)
      return label && isSafeLink(url) ? { id, type: 'button', label, url } : null
    }
    case 'divider':
      return { id, type: 'divider', label: text('label', L.label) }
    case 'spacer':
      return {
        id,
        type: 'spacer',
        size: b.size === 'small' || b.size === 'large' ? b.size : 'medium',
      }
    case 'social':
      return { id, type: 'social' }
    case 'help':
      return { id, type: 'help' }
    case 'footer':
      return { id, type: 'footer', social: b.social !== false }
    default:
      return null
  }
}

export function parseEmailDesign(raw: unknown): EmailTemplateDesign | null {
  if (!isObj(raw) || raw.version !== DESIGN_VERSION || !Array.isArray(raw.blocks)) return null
  try {
    if (JSON.stringify(raw).length > L.bytes) return null
  } catch {
    return null
  }
  const ids = new Set<string>()
  const blocks: DesignBlock[] = []
  for (const b of raw.blocks.slice(0, L.blocks)) {
    const block = parseBlock(b)
    if (!block || ids.has(block.id)) continue
    ids.add(block.id)
    blocks.push(block)
  }
  // One intro only; a second is ignored.
  const firstIntro = blocks.findIndex((b) => b.type === 'intro')
  const cleaned = blocks.filter((b, i) => b.type !== 'intro' || i === firstIntro)
  const removed = Array.isArray(raw.removed)
    ? raw.removed
        .filter((k): k is string => typeof k === 'string' && SLOT_KEY.test(k))
        .slice(0, L.blocks)
    : []
  return {
    version: DESIGN_VERSION,
    subject: str(raw.subject, L.subject)?.trim() || undefined,
    blocks: cleaned,
    removed,
  }
}
