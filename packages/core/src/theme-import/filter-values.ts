/** SOURCE OF TRUTH: the values behind Shopify's Liquid filters — WHAT: the per-render runtime filters read, filter argument parsing, translations with plurals, Shopify money formats, image URLs and `image_tag` markup, placeholder art, colour maths and payment marks / WHY: kept apart from the filter table so each piece is testable and the table stays readable */
import { type Currency, formatMoney } from '@commerce/money'
import { Drop } from 'liquidjs'
import { ColorDrop, type FontDrop, ImageDrop } from './drops'

/** What filters need from the render that called them; passed as the `_rt` global. */
export type LiquidRuntime = {
  /** `asset_url` for a file in `assets/`: our URL, versioned by checksum. */
  assetUrl: (file: string) => string
  /** A text asset's contents, for `inline_asset_content`. */
  assetText: (file: string) => string | null
  /** The theme's storefront locale (`locales/en.default.json`), nested keys. */
  locale: Record<string, unknown>
  currency: Currency
  /** Shopify `money_format`, e.g. `₹{{amount_no_decimals}}`; null formats with @commerce/money. */
  moneyFormat: string | null
  /** Fonts the theme asked for with `font_face`; the layout loads them. */
  fonts: Map<string, FontDrop>
  /** Script nonce for the storefront's CSP; blank in the editor canvas. */
  nonce: string
  /** The merchant's old Shopify host, for `file_url` images we did not copy. */
  shopifyHost: string | null
  /** Our URL for a Shopify file name the importer copied (loose name match), else null. */
  importedFileUrl?: ((name: string) => string | null) | undefined
  /** Told when a render reads the clock (`'now' | date`), so a cache keeps that output briefly. */
  onClock?: (() => void) | undefined
}

export type Named = Record<string, unknown>

/** Liquid passes `key: value` filter arguments as `[key, value]` pairs. */
export function splitArgs(args: unknown[]): { positional: unknown[]; named: Named } {
  const positional: unknown[] = []
  const named: Named = {}
  for (const a of args) {
    if (Array.isArray(a) && a.length === 2 && typeof a[0] === 'string') named[a[0]] = a[1]
    else positional.push(a)
  }
  return { positional, named }
}

/** Tells the runtime a render read the clock; a bare engine render (tests) has none to tell. */
export function noteClockRead(self: unknown): void {
  const ctx = (self as { context?: { globals?: { _rt?: LiquidRuntime } } }).context
  ctx?.globals?._rt?.onClock?.()
}

export function runtimeOf(self: unknown): LiquidRuntime {
  const ctx = (self as { context?: { globals?: { _rt?: LiquidRuntime } } }).context
  const rt = ctx?.globals?._rt
  if (!rt) throw new Error('Liquid render without a runtime')
  return rt
}

export const escapeAttr = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

export const str = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (value instanceof Drop) return String(value.valueOf() ?? '')
  return String(value)
}

/** `a.b.c` in the locale, or undefined. */
export function lookup(tree: Record<string, unknown>, key: string): unknown {
  let node: unknown = tree
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return node
}

/** `{{ name }}` placeholders in a translation. */
const interpolate = (text: string, vars: Named): string =>
  text.replace(/{{\s*([\w.]+)\s*}}/g, (_, k: string) => str(vars[k]))

/** Shopify's `t`: plural forms by `count`, `{{ var }}` interpolation, missing keys shown. */
export function translate(locale: Record<string, unknown>, key: string, vars: Named): string {
  let value = lookup(locale, key)
  if (value && typeof value === 'object' && 'count' in vars) {
    const forms = value as Record<string, unknown>
    const n = Number(vars.count)
    value = (n === 0 ? forms.zero : undefined) ?? (n === 1 ? forms.one : forms.other) ?? forms.other
  }
  if (typeof value !== 'string') return `Translation missing: en.${key}`
  return interpolate(value, vars)
}

/** Shopify money formats: `{{amount}}`, `{{amount_no_decimals}}`, comma separators. */
export function shopifyMoney(paise: number, format: string): string {
  const major = paise / 100
  const group = (n: string, sep: string) => n.replace(/\B(?=(\d{3})+(?!\d))/g, sep)
  const parts = (decimals: number, thousands: string, point: string) => {
    const [whole = '0', frac] = Math.abs(major).toFixed(decimals).split('.')
    const sign = major < 0 ? '-' : ''
    return `${sign}${group(whole, thousands)}${frac ? `${point}${frac}` : ''}`
  }
  return format.replace(/{{\s*(\w+)\s*}}/g, (_, name: string) => {
    switch (name) {
      case 'amount':
        return parts(2, ',', '.')
      case 'amount_no_decimals':
        return parts(0, ',', '.')
      case 'amount_with_comma_separator':
        return parts(2, '.', ',')
      case 'amount_no_decimals_with_comma_separator':
        return parts(0, '.', ',')
      case 'amount_with_apostrophe_separator':
        return parts(2, "'", '.')
      case 'amount_no_decimals_with_space_separator':
        return parts(0, ' ', '.')
      case 'amount_with_space_separator':
        return parts(2, ' ', ',')
      default:
        return parts(2, ',', '.')
    }
  })
}

export function money(rt: LiquidRuntime, value: unknown): string {
  const paise = Number(value ?? 0)
  if (!Number.isFinite(paise)) return ''
  return rt.moneyFormat
    ? shopifyMoney(paise, rt.moneyFormat)
    : formatMoney(Math.round(paise), rt.currency)
}

/**
 * What an image filter reads inside a value: a product's or variant's image, or a
 * metafield's value (`feature.image | image_url`, a file field).
 */
const innerImage = (v: Record<string, unknown>): unknown =>
  v.featured_image ??
  v.image ??
  v.preview_image ??
  v.src ??
  (v instanceof Drop ? v.value : undefined)

/** The image URL a value stands for: an image object, a URL string, or a product/variant. */
export function imageSrc(value: unknown): string {
  if (value instanceof ImageDrop) return value.src
  if (value instanceof ImageUrl) return value.url
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const inner = innerImage(value as Record<string, unknown>)
    if (inner !== undefined && inner !== value) return imageSrc(inner)
  }
  return ''
}

/**
 * What `image_url` returns: prints as the URL, but remembers the image so a following
 * `image_tag` can write its width, height and alt, as Shopify's does.
 */
class ImageUrl extends Drop {
  constructor(
    readonly url: string,
    readonly image: ImageDrop | null,
    readonly width: number | null,
    readonly height: number | null,
  ) {
    super()
  }
  override valueOf(): string {
    return this.url
  }
  override toString(): string {
    return this.url
  }
}

const imageOf = (value: unknown): ImageDrop | null => {
  if (value instanceof ImageDrop) return value
  if (value && typeof value === 'object') {
    const inner = innerImage(value as Record<string, unknown>)
    if (inner instanceof ImageDrop) return inner
    if (inner && typeof inner === 'object' && inner !== value) return imageOf(inner)
  }
  return null
}

export function imageUrl(value: unknown, named: Named): ImageUrl | string {
  const src = imageSrc(value)
  if (!src) return ''
  const width = named.width ? Number(named.width) : null
  const height = named.height ? Number(named.height) : null
  return new ImageUrl(src, imageOf(value), width, height)
}

/** Attributes Shopify's `image_tag` writes itself; anything else passes through. */
const IMAGE_TAG_OWN = new Set(['widths', 'preload', 'srcset'])

export function imageTag(value: unknown, named: Named): string {
  const url = value instanceof ImageUrl ? value : null
  const src = url ? url.url : imageSrc(value)
  if (!src) return ''
  const image = url?.image ?? imageOf(value)
  const naturalW = image?.width ?? null
  const naturalH = image?.height ?? null
  let width = named.width ?? url?.width ?? naturalW
  let height = named.height ?? url?.height ?? null
  if (width && !height && naturalW && naturalH) {
    height = Math.round((Number(width) * naturalH) / naturalW)
  }
  if (!width && height && naturalW && naturalH) {
    width = Math.round((Number(height) * naturalW) / naturalH)
  }
  const attrs: Record<string, unknown> = {
    src,
    alt: named.alt ?? image?.alt ?? '',
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  }
  for (const [k, v] of Object.entries(named)) {
    if (k === 'alt' || k === 'width' || k === 'height' || IMAGE_TAG_OWN.has(k)) continue
    if (v === null || v === undefined || v === false) continue
    attrs[k] = v
  }
  if (named.preload) attrs.fetchpriority ??= 'high'
  return `<img ${Object.entries(attrs)
    .map(([k, v]) => `${k}="${escapeAttr(str(v))}"`)
    .join(' ')}>`
}

/** A neutral stand-in for Shopify's placeholder illustrations. */
export function placeholderSvg(name: unknown, className: unknown): string {
  const cls = className ? ` class="${escapeAttr(className)}"` : ''
  const label = escapeAttr(str(name) || 'image')
  return `<svg${cls} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 525 525" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${label}"><rect width="525" height="525" fill="currentColor" opacity=".08"/><path d="M197 312l52-66 38 48 26-33 46 51z" fill="currentColor" opacity=".25"/><circle cx="315" cy="214" r="18" fill="currentColor" opacity=".25"/></svg>`
}

/** Hex/rgb colour parsing for the colour filters. */
export function toRgb(value: unknown): { r: number; g: number; b: number; a: number } {
  const c = value instanceof ColorDrop ? value : new ColorDrop(str(value))
  return { r: c.red, g: c.green, b: c.blue, a: c.alpha }
}

export function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }) {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255]
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: l * 100 }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0)
  else if (max === gg) h = (bb - rr) / d + 2
  else h = (rr - gg) / d + 4
  return { h: h * 60, s: s * 100, l: l * 100 }
}

export function hslToHex(h: number, s: number, l: number): string {
  const sat = Math.max(0, Math.min(100, s)) / 100
  const lig = Math.max(0, Math.min(100, l)) / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sat * Math.min(lig, 1 - lig)
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const hex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`
}

export function adjustLightness(value: unknown, delta: number): string {
  const hsl = rgbToHsl(toRgb(value))
  return hslToHex(hsl.h, hsl.s, hsl.l + delta)
}

export function adjustSaturation(value: unknown, delta: number): string {
  const hsl = rgbToHsl(toRgb(value))
  return hslToHex(hsl.h, hsl.s + delta, hsl.l)
}

export const brightness = (value: unknown): number => {
  const { r, g, b } = toRgb(value)
  return Math.round((r * 299 + g * 587 + b * 114) / 1000)
}

/** Simple, label-only payment marks (Shopify's own artwork is theirs, not ours to copy). */
export function paymentIcon(type: unknown): string {
  const label = escapeAttr(
    str(type)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()),
  )
  return `<svg class="icon icon--full-color" xmlns="http://www.w3.org/2000/svg" role="img" viewBox="0 0 38 24" width="38" height="24" aria-label="${label}"><rect x=".5" y=".5" width="37" height="23" rx="3" fill="#fff" stroke="#000" stroke-opacity=".07"/><text x="19" y="15" text-anchor="middle" font-family="Arial, sans-serif" font-size="6.5" font-weight="700" fill="#222">${label.slice(0, 10)}</text></svg>`
}

type VideoSourceLike = { url?: string; mime_type?: string; height?: number }

/**
 * `video | video_tag` / `media | media_tag` for a video copied into Files: every mp4
 * rendition as a `<source>` (the smaller one for phones, `max-width: 749px`), the poster
 * picture, and the flags the theme asked for.
 */
export function videoTag(video: unknown, named: Named): string {
  const v = video as {
    sources?: VideoSourceLike[]
    url?: string
    preview_image?: { src: string } | null
  } | null
  const listed = (v?.sources ?? []).filter(
    (s) => s.url && (s.mime_type ?? 'video/mp4') === 'video/mp4',
  )
  const sources = [...listed].sort((a, b) => (a.height ?? 0) - (b.height ?? 0))
  const fallback = v?.url ?? (typeof video === 'string' ? video : '')
  if (sources.length === 0 && !fallback) return ''
  const flags = ['autoplay', 'loop', 'muted', 'controls']
    .filter((f) => named[f])
    .map((f) => `${f}="${f}"`)
  const attrs = [
    'playsinline="true"',
    named.class ? `class="${escapeAttr(named.class)}"` : '',
    ...flags,
    `preload="${escapeAttr(named.preload ?? 'metadata')}"`,
    v?.preview_image ? `poster="${escapeAttr(v.preview_image.src)}"` : '',
  ].filter(Boolean)
  const tags =
    sources.length > 1
      ? sources.map((s, i) =>
          i === 0
            ? `<source src="${escapeAttr(s.url ?? '')}" type="video/mp4" media="(max-width: 749px)">`
            : `<source src="${escapeAttr(s.url ?? '')}" type="video/mp4">`,
        )
      : [`<source src="${escapeAttr(sources[0]?.url ?? fallback)}" type="video/mp4">`]
  return `<video ${attrs.join(' ')}>${tags.join('')}</video>`
}

/**
 * A Shopify Files name as one comparable key. A theme setting says `shopify://files/videos/Keyboard Bento.mp4`
 * while Shopify's own file name may come back as `Keyboard_Bento.mp4` or percent-encoded:
 * case, spaces, underscores and hyphens do not tell two files apart.
 */
export function importedFileKey(name: string): string {
  let decoded = name
  try {
    decoded = decodeURIComponent(name)
  } catch {
    // not percent-encoded
  }
  return decoded
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
}
