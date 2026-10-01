/** SOURCE OF TRUTH: Shopify Liquid filters for imported themes — WHAT: every Shopify-only filter a theme uses (t, asset_url, image_url, image_tag, money, placeholder_svg_tag, font_face, colour maths, link and URL helpers, payment icons...) implemented on our data, plus the per-render runtime they read / WHY: LiquidJS ships the standard Liquid filters only; a theme's look depends on these producing the same markup Shopify does, pointed at our assets, prices and pages */
import { type Currency, formatMoney, formatNumber } from '@commerce/money'
import { Drop, type FilterImplOptions, type Liquid } from 'liquidjs'
import { ColorDrop, FontDrop, handleize, ImageDrop, LIQUID_ROUTES } from './drops'

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
}

type Named = Record<string, unknown>

/** Liquid passes `key: value` filter arguments as `[key, value]` pairs. */
function splitArgs(args: unknown[]): { positional: unknown[]; named: Named } {
  const positional: unknown[] = []
  const named: Named = {}
  for (const a of args) {
    if (Array.isArray(a) && a.length === 2 && typeof a[0] === 'string') named[a[0]] = a[1]
    else positional.push(a)
  }
  return { positional, named }
}

function runtimeOf(self: unknown): LiquidRuntime {
  const ctx = (self as { context?: { globals?: { _rt?: LiquidRuntime } } }).context
  const rt = ctx?.globals?._rt
  if (!rt) throw new Error('Liquid render without a runtime')
  return rt
}

const escapeAttr = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const str = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (value instanceof Drop) return String(value.valueOf() ?? '')
  return String(value)
}

/** `a.b.c` in the locale, or undefined. */
function lookup(tree: Record<string, unknown>, key: string): unknown {
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

function money(rt: LiquidRuntime, value: unknown): string {
  const paise = Number(value ?? 0)
  if (!Number.isFinite(paise)) return ''
  return rt.moneyFormat
    ? shopifyMoney(paise, rt.moneyFormat)
    : formatMoney(Math.round(paise), rt.currency)
}

/** The image URL a value stands for: an image object, a URL string, or a product/variant. */
function imageSrc(value: unknown): string {
  if (value instanceof ImageDrop) return value.src
  if (value instanceof ImageUrl) return value.url
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>
    const inner = v.featured_image ?? v.image ?? v.preview_image ?? v.src
    if (inner !== undefined && inner !== value) return imageSrc(inner)
  }
  return ''
}

/**
 * What `image_url` returns: prints as the URL, but remembers the image so a following
 * `image_tag` can write its width, height and alt, as Shopify's does.
 */
export class ImageUrl extends Drop {
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
    const v = value as Record<string, unknown>
    const inner = v.featured_image ?? v.image ?? v.preview_image
    if (inner instanceof ImageDrop) return inner
  }
  return null
}

function imageUrl(value: unknown, named: Named): ImageUrl | string {
  const src = imageSrc(value)
  if (!src) return ''
  const width = named.width ? Number(named.width) : null
  const height = named.height ? Number(named.height) : null
  return new ImageUrl(src, imageOf(value), width, height)
}

/** Attributes Shopify's `image_tag` writes itself; anything else passes through. */
const IMAGE_TAG_OWN = new Set(['widths', 'preload', 'srcset'])

function imageTag(value: unknown, named: Named): string {
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
function placeholderSvg(name: unknown, className: unknown): string {
  const cls = className ? ` class="${escapeAttr(className)}"` : ''
  const label = escapeAttr(str(name) || 'image')
  return `<svg${cls} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 525 525" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${label}"><rect width="525" height="525" fill="currentColor" opacity=".08"/><path d="M197 312l52-66 38 48 26-33 46 51z" fill="currentColor" opacity=".25"/><circle cx="315" cy="214" r="18" fill="currentColor" opacity=".25"/></svg>`
}

/** Hex/rgb colour parsing for the colour filters. */
function toRgb(value: unknown): { r: number; g: number; b: number; a: number } {
  const c = value instanceof ColorDrop ? value : new ColorDrop(str(value))
  return { r: c.red, g: c.green, b: c.blue, a: c.alpha }
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }) {
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

function hslToHex(h: number, s: number, l: number): string {
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

function adjustLightness(value: unknown, delta: number): string {
  const hsl = rgbToHsl(toRgb(value))
  return hslToHex(hsl.h, hsl.s, hsl.l + delta)
}

function adjustSaturation(value: unknown, delta: number): string {
  const hsl = rgbToHsl(toRgb(value))
  return hslToHex(hsl.h, hsl.s + delta, hsl.l)
}

const brightness = (value: unknown): number => {
  const { r, g, b } = toRgb(value)
  return Math.round((r * 299 + g * 587 + b * 114) / 1000)
}

/** Simple, label-only payment marks (Shopify's own artwork is theirs, not ours to copy). */
function paymentIcon(type: unknown): string {
  const label = escapeAttr(
    str(type)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()),
  )
  return `<svg class="icon icon--full-color" xmlns="http://www.w3.org/2000/svg" role="img" viewBox="0 0 38 24" width="38" height="24" aria-label="${label}"><rect x=".5" y=".5" width="37" height="23" rx="3" fill="#fff" stroke="#000" stroke-opacity=".07"/><text x="19" y="15" text-anchor="middle" font-family="Arial, sans-serif" font-size="6.5" font-weight="700" fill="#222">${label.slice(0, 10)}</text></svg>`
}

/**
 * Registers the Shopify filters on an engine. Unknown filters pass their input
 * through (LiquidJS's lenient mode), so a theme using one we lack still renders.
 */
export function registerShopifyFilters(engine: Liquid): void {
  const add = (name: string, fn: FilterImplOptions) => engine.registerFilter(name, fn)

  add('t', function (this: unknown, key: unknown, ...args: unknown[]) {
    const { named } = splitArgs(args)
    return translate(runtimeOf(this).locale, str(key), named)
  })
  engine.registerFilter('translate', engine.filters.t as FilterImplOptions)

  add('asset_url', function (this: unknown, file: unknown) {
    return runtimeOf(this).assetUrl(str(file))
  })
  add('asset_img_url', function (this: unknown, file: unknown) {
    return runtimeOf(this).assetUrl(str(file))
  })
  add('inline_asset_content', function (this: unknown, file: unknown) {
    return runtimeOf(this).assetText(str(file)) ?? ''
  })
  add('file_url', function (this: unknown, file: unknown) {
    const host = runtimeOf(this).shopifyHost
    return host ? `https://${host}/cdn/shop/files/${encodeURIComponent(str(file))}` : ''
  })
  engine.registerFilter('file_img_url', engine.filters.file_url as FilterImplOptions)
  add('global_asset_url', () => '')
  add('shopify_asset_url', () => '')

  add('stylesheet_tag', (url: unknown) =>
    url ? `<link href="${escapeAttr(str(url))}" rel="stylesheet" type="text/css" media="all" />` : '',
  )
  add('script_tag', function (this: unknown, url: unknown) {
    if (!url) return ''
    const nonce = runtimeOf(this).nonce
    return `<script src="${escapeAttr(str(url))}" type="text/javascript"${nonce ? ` nonce="${escapeAttr(nonce)}"` : ''}></script>`
  })
  add('preload_tag', (url: unknown, ...args: unknown[]) => {
    if (!url) return ''
    const { named } = splitArgs(args)
    const as = named.as ? ` as="${escapeAttr(named.as)}"` : ''
    return `<link href="${escapeAttr(str(url))}" rel="preload"${as}>`
  })

  add('image_url', (value: unknown, ...args: unknown[]) => imageUrl(value, splitArgs(args).named))
  for (const legacy of ['img_url', 'product_img_url', 'collection_img_url', 'article_img_url']) {
    add(legacy, (value: unknown) => imageSrc(value))
  }
  add('image_tag', (value: unknown, ...args: unknown[]) => imageTag(value, splitArgs(args).named))
  add('img_tag', (value: unknown, alt: unknown) =>
    imageTag(value, alt ? { alt } : {}),
  )
  add('placeholder_svg_tag', (name: unknown, className: unknown) =>
    placeholderSvg(name, className),
  )

  add('money', function (this: unknown, value: unknown) {
    return money(runtimeOf(this), value)
  })
  add('money_with_currency', function (this: unknown, value: unknown) {
    const rt = runtimeOf(this)
    return `${money(rt, value)} ${rt.currency}`
  })
  add('money_without_currency', (value: unknown) =>
    formatNumber(Number(value ?? 0) / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  )
  add('money_without_trailing_zeros', function (this: unknown, value: unknown) {
    return money(runtimeOf(this), value).replace(/\.00$/, '')
  })

  add('json', (value: unknown) => {
    const seen = new WeakSet<object>()
    return JSON.stringify(value ?? null, (_k, v: unknown) => {
      if (v instanceof Drop && !(v instanceof ImageDrop) && 'valueOf' in v) {
        const plain = v.valueOf()
        if (typeof plain !== 'object') return plain
      }
      if (v && typeof v === 'object') {
        if (seen.has(v)) return undefined
        seen.add(v)
      }
      return v
    })
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
  })
  add('default_errors', () => '')
  add('structured_data', () => '')
  add('payment_button', () => '')
  add('payment_terms', () => '')
  add('metafield_tag', () => '')
  add('metafield_text', () => '')
  add('customer_login_link', (text: unknown) => `<a href="${LIQUID_ROUTES.account_login_url}">${str(text)}</a>`)
  add('customer_logout_link', (text: unknown) => `<a href="${LIQUID_ROUTES.account_logout_url}">${str(text)}</a>`)
  add('customer_register_link', (text: unknown) => `<a href="${LIQUID_ROUTES.account_register_url}">${str(text)}</a>`)
  add('payment_type_svg_tag', (type: unknown) => paymentIcon(type))
  add('payment_type_img_url', () => '')

  add('handle', (value: unknown) => handleize(str(value)))
  add('handleize', (value: unknown) => handleize(str(value)))
  add('camelize', (value: unknown) =>
    str(value)
      .replace(/[-_\s]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ''))
      .replace(/^./, (c) => c.toUpperCase()),
  )
  add('pluralize', (n: unknown, one: unknown, many: unknown) =>
    Number(n) === 1 ? str(one) : str(many),
  )
  add('highlight', (text: unknown, term: unknown) => {
    const t = str(term)
    if (!t) return str(text)
    const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    return str(text).replace(re, '<strong class="highlight">$1</strong>')
  })
  add('url_param_escape', (value: unknown) => encodeURIComponent(str(value)))
  add('url_escape', (value: unknown) => encodeURI(str(value)))
  add('base64_encode', (value: unknown) => Buffer.from(str(value)).toString('base64'))
  add('base64_decode', (value: unknown) => Buffer.from(str(value), 'base64').toString('utf8'))
  add('weight_with_unit', (grams: unknown) => `${(Number(grams ?? 0) / 1000).toFixed(2)} kg`)
  add('unit_price_with_measurement', () => '')

  add('link_to', (text: unknown, url: unknown, title: unknown) =>
    `<a href="${escapeAttr(url)}"${title ? ` title="${escapeAttr(title)}"` : ''}>${str(text)}</a>`,
  )
  add('url_for_type', (type: unknown) => `/collections/types?q=${encodeURIComponent(str(type))}`)
  add('url_for_vendor', (v: unknown) => `/collections/vendors?q=${encodeURIComponent(str(v))}`)
  add('link_to_type', (type: unknown) =>
    `<a href="/collections/types?q=${encodeURIComponent(str(type))}" title="${escapeAttr(type)}">${str(type)}</a>`,
  )
  add('link_to_vendor', (v: unknown) =>
    `<a href="/collections/vendors?q=${encodeURIComponent(str(v))}" title="${escapeAttr(v)}">${str(v)}</a>`,
  )
  add('link_to_tag', (label: unknown, tag: unknown) =>
    `<a href="?tag=${encodeURIComponent(str(tag))}" title="${escapeAttr(tag)}">${str(label)}</a>`,
  )
  add('within', (url: unknown, collection: unknown) => {
    const c = collection as { url?: string } | null
    return c?.url ? `${c.url}${str(url)}` : str(url)
  })
  add('sort_by', (url: unknown, sort: unknown) => `${str(url)}?sort_by=${encodeURIComponent(str(sort))}`)

  add('time_tag', (value: unknown, ...args: unknown[]) => {
    const date = value instanceof Date ? value : new Date(str(value))
    if (Number.isNaN(date.getTime())) return ''
    const text = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const { named } = splitArgs(args)
    const datetime = named.datetime ? str(named.datetime) : date.toISOString()
    return `<time datetime="${escapeAttr(datetime)}">${text}</time>`
  })
  add('format_address', (address: unknown) => {
    if (!address || typeof address !== 'object') return ''
    const a = address as Record<string, unknown>
    const lines = [a.name, a.company, a.address1, a.address2, [a.city, a.province, a.zip].filter(Boolean).join(' '), a.country]
      .map((x) => str(x).trim())
      .filter(Boolean)
    return lines.map((l) => `<span>${l}</span>`).join('<br>')
  })

  add('font_face', function (this: unknown, font: unknown) {
    if (font instanceof FontDrop && !font.system) runtimeOf(this).fonts.set(font.handle, font)
    return ''
  })
  add('font_url', function (this: unknown, font: unknown) {
    if (font instanceof FontDrop && !font.system) runtimeOf(this).fonts.set(font.handle, font)
    return ''
  })
  add('font_modify', (font: unknown, attr: unknown, value: unknown) => {
    if (!(font instanceof FontDrop)) return font
    const m = /^(.+)_([nio])(\d)$/.exec(font.handle)
    if (!m) return font
    const [, base, style, weight] = m
    if (str(attr) === 'weight') {
      const v = str(value)
      const w = Number(weight)
      const next =
        v === 'bold' || v === 'bolder' ? Math.min(9, Math.max(w + 3, 7)) : v === 'lighter' ? Math.max(1, w - 3) : v === 'normal' ? 4 : /^[+-]\d+$/.test(v) ? w + Number(v) / 100 : Number(v) / 100
      return new FontDrop(`${base}_${style}${Math.max(1, Math.min(9, Math.round(next)))}`)
    }
    if (str(attr) === 'style') {
      const v = str(value)
      return new FontDrop(`${base}_${v === 'italic' ? 'i' : v === 'oblique' ? 'o' : 'n'}${weight}`)
    }
    return font
  })

  add('color_to_rgb', (c: unknown) => {
    const { r, g, b, a } = toRgb(c)
    return a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgb(${r}, ${g}, ${b})`
  })
  add('color_to_hex', (c: unknown) => toRgb(c) && new ColorDrop(str(c)).hex)
  add('color_to_hsl', (c: unknown) => {
    const { h, s, l } = rgbToHsl(toRgb(c))
    return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`
  })
  add('color_lighten', (c: unknown, n: unknown) => adjustLightness(c, Number(n ?? 0)))
  add('color_darken', (c: unknown, n: unknown) => adjustLightness(c, -Number(n ?? 0)))
  add('color_saturate', (c: unknown, n: unknown) => adjustSaturation(c, Number(n ?? 0)))
  add('color_desaturate', (c: unknown, n: unknown) => adjustSaturation(c, -Number(n ?? 0)))
  add('color_brightness', (c: unknown) => brightness(c))
  add('color_extract', (c: unknown, part: unknown) => {
    const rgb = toRgb(c)
    const hsl = rgbToHsl(rgb)
    const map: Record<string, number> = {
      red: rgb.r,
      green: rgb.g,
      blue: rgb.b,
      alpha: rgb.a,
      hue: Math.round(hsl.h),
      saturation: Math.round(hsl.s),
      lightness: Math.round(hsl.l),
    }
    return map[str(part)] ?? 0
  })
  add('color_modify', (c: unknown, part: unknown, value: unknown) => {
    const rgb = toRgb(c)
    const v = Number(value)
    if (str(part) === 'alpha') return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${v})`
    const hsl = rgbToHsl(rgb)
    if (str(part) === 'lightness') return hslToHex(hsl.h, hsl.s, v)
    if (str(part) === 'saturation') return hslToHex(hsl.h, v, hsl.l)
    if (str(part) === 'hue') return hslToHex(v, hsl.s, hsl.l)
    const next = { ...rgb, [str(part).charAt(0)]: v }
    return new ColorDrop(
      `#${[next.r, next.g, next.b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('')}`,
    ).hex
  })
  add('color_mix', (a: unknown, b: unknown, weight: unknown) => {
    const x = toRgb(a)
    const y = toRgb(b)
    const w = Number(weight ?? 50) / 100
    const mix = (p: number, q: number) =>
      Math.round(p * w + q * (1 - w))
        .toString(16)
        .padStart(2, '0')
    return `#${mix(x.r, y.r)}${mix(x.g, y.g)}${mix(x.b, y.b)}`
  })
  add('color_contrast', (a: unknown, b: unknown) => {
    const lum = (c: unknown) => {
      const { r, g, b: bl } = toRgb(c)
      const ch = (v: number) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(bl)
    }
    const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number]
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 10) / 10
  })
  add('color_difference', (a: unknown, b: unknown) => {
    const x = toRgb(a)
    const y = toRgb(b)
    return Math.abs(x.r - y.r) + Math.abs(x.g - y.g) + Math.abs(x.b - y.b)
  })
  add('brightness_difference', (a: unknown, b: unknown) => Math.abs(brightness(a) - brightness(b)))

  add('video_tag', (video: unknown, ...args: unknown[]) => {
    const { named } = splitArgs(args)
    const v = video as { sources?: { url: string; mime_type: string }[]; url?: string } | null
    const src = v?.sources?.[0]?.url ?? v?.url ?? (typeof video === 'string' ? video : '')
    if (!src) return ''
    const flags = ['autoplay', 'loop', 'muted', 'controls', 'playsinline']
      .filter((f) => named[f])
      .join(' ')
    const cls = named.class ? ` class="${escapeAttr(named.class)}"` : ''
    const poster = named.image_size || named.poster ? '' : ''
    return `<video${cls} ${flags}${poster} preload="metadata"><source src="${escapeAttr(src)}" type="video/mp4"></video>`
  })
  add('external_video_url', (video: unknown) => {
    const v = video as { host?: string; external_id?: string } | null
    if (!v?.external_id) return ''
    return v.host === 'vimeo'
      ? `https://player.vimeo.com/video/${v.external_id}`
      : `https://www.youtube.com/embed/${v.external_id}`
  })
  add('external_video_tag', (video: unknown) => {
    const v = video as { host?: string; external_id?: string } | null
    if (!v?.external_id) return ''
    const src =
      v.host === 'vimeo'
        ? `https://player.vimeo.com/video/${v.external_id}`
        : `https://www.youtube.com/embed/${v.external_id}`
    return `<iframe src="${escapeAttr(src)}" allow="autoplay; encrypted-media" allowfullscreen loading="lazy"></iframe>`
  })
  add('media_tag', (media: unknown) => imageTag(media, {}))
  add('model_viewer_tag', () => '')

  // `date` with Shopify's named formats; LiquidJS's own handles strftime strings.
  const baseDate = engine.filters.date as FilterImplOptions
  engine.registerFilter('date', function (this: unknown, value: unknown, ...args: unknown[]) {
    const { positional, named } = splitArgs(args)
    const format = str(named.format ?? positional[0] ?? '')
    const named_: Record<string, string> = {
      abbreviated_date: '%b %d, %Y',
      basic: '%m/%d/%Y',
      date: '%B %d, %Y',
      default: '%a, %b %d, %Y, %-l:%M %P',
      on_date: 'on %b %d, %Y',
      month_day_year: '%B %d, %Y',
    }
    const fmt = named_[format] ?? format
    const impl = typeof baseDate === 'function' ? baseDate : baseDate.handler
    return (impl as (this: unknown, v: unknown, f: string) => unknown).call(
      this,
      value === 'now' || value === 'today' ? new Date() : value,
      fmt,
    )
  })
}

export { splitArgs, str as stringifyLiquid, escapeAttr }
