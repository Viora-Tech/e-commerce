/** SOURCE OF TRUTH: Shopify Liquid filters for imported themes — WHAT: every Shopify-only filter a theme uses (t, asset_url, image_url, image_tag, money, placeholder_svg_tag, font_face, colour maths, link and URL helpers, payment icons...) implemented on our data, plus the per-render runtime they read / WHY: LiquidJS ships the standard Liquid filters only; a theme's look depends on these producing the same markup Shopify does, pointed at our assets, prices and pages */
import { formatInZone } from '@commerce/dates'
import { formatNumber } from '@commerce/money'
import { Drop, type FilterImplOptions, type Liquid } from 'liquidjs'
import { ColorDrop, FontDrop, handleize, ImageDrop, LIQUID_ROUTES } from './drops'
import {
  adjustLightness,
  adjustSaturation,
  brightness,
  escapeAttr,
  hslToHex,
  imageSrc,
  imageTag,
  imageUrl,
  money,
  noteClockRead,
  paymentIcon,
  placeholderSvg,
  rgbToHsl,
  runtimeOf,
  splitArgs,
  str,
  toRgb,
  translate,
  videoTag,
} from './filter-values'

/** A filter's input as a list: nothing is empty, one object is a list of one. */
function listOf(value: unknown): unknown[] {
  if (value === null || value === undefined || value === '') return []
  if (Array.isArray(value)) return value
  if (typeof value === 'object' && Symbol.iterator in value)
    return [...(value as Iterable<unknown>)]
  return [value]
}

/** What `form.errors | default_errors` prints after a post we rejected. */
const FORM_ERRORS_HTML =
  '<ul class="errors" role="alert"><li>Please check your details and try again.</li></ul>'

export type { LiquidRuntime } from './filter-values'

/**
 * Registers the Shopify filters on an engine. Unknown filters pass their input
 * through (LiquidJS's lenient mode), so a theme using one we lack still renders.
 */
export function registerShopifyFilters(engine: Liquid): void {
  const add = (name: string, fn: FilterImplOptions) => engine.registerFilter(name, fn)

  // LiquidJS's own `default` unwraps an object to its `valueOf()`, so an image picked by
  // `block.settings.image | default: collection.image` became a bare URL and lost its sized
  // copies: `image_url: width: 900` then handed out the multi-MB original. Same blank rules as
  // Shopify (nil, false, '' and empty lists), but the value itself goes through untouched.
  add('default', (value: unknown, fallback: unknown, ...args: unknown[]) => {
    const allowFalse = splitArgs(args).named.allow_false === true
    const raw = value instanceof Drop ? value.valueOf() : value
    const blank =
      raw === null ||
      raw === undefined ||
      raw === '' ||
      (raw === false && !allowFalse) ||
      (Array.isArray(raw) && raw.length === 0)
    return blank ? fallback : value
  })

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
    const rt = runtimeOf(this)
    const ours = rt.importedFileUrl?.(str(file))
    if (ours) return ours
    const host = rt.shopifyHost
    return host ? `https://${host}/cdn/shop/files/${encodeURIComponent(str(file))}` : ''
  })
  engine.registerFilter('file_img_url', engine.filters.file_url as FilterImplOptions)
  // Shopify treats one object as a list of one (`product.featured_media | concat: others`);
  // LiquidJS would split it into its fields.
  add('concat', (value: unknown, other: unknown) => [...listOf(value), ...listOf(other)])
  // `reject: 'src', product.featured_media` compares with the object's own `src`.
  const reject = engine.filters.reject as (...args: unknown[]) => unknown
  add('reject', function (this: unknown, list: unknown, key: unknown, ...rest: unknown[]) {
    const expected = rest[0]
    const own =
      expected && typeof expected === 'object'
        ? (expected as Record<string, unknown>)[String(key)]
        : undefined
    return reject.call(this, list, key, ...(own === undefined ? rest : [own]))
  } as FilterImplOptions)
  add('global_asset_url', () => '')
  add('shopify_asset_url', () => '')

  add('stylesheet_tag', (url: unknown) =>
    url
      ? `<link href="${escapeAttr(str(url))}" rel="stylesheet" type="text/css" media="all" />`
      : '',
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
  add('img_tag', (value: unknown, alt: unknown) => imageTag(value, alt ? { alt } : {}))
  add('placeholder_svg_tag', (name: unknown, className: unknown) => placeholderSvg(name, className))

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
  add('default_errors', (errors: unknown) =>
    Array.isArray(errors) && errors.length > 0 ? FORM_ERRORS_HTML : '',
  )
  add('structured_data', () => '')
  add('payment_button', () => '')
  add('payment_terms', () => '')
  // Shopify's "Sign in with Shop" button: no Shop login here, so nothing (not "[object Object]").
  add('login_button', () => '')
  add('metafield_tag', () => '')
  add('metafield_text', () => '')
  add(
    'customer_login_link',
    (text: unknown) => `<a href="${LIQUID_ROUTES.account_login_url}">${str(text)}</a>`,
  )
  add(
    'customer_logout_link',
    (text: unknown) => `<a href="${LIQUID_ROUTES.account_logout_url}">${str(text)}</a>`,
  )
  add(
    'customer_register_link',
    (text: unknown) => `<a href="${LIQUID_ROUTES.account_register_url}">${str(text)}</a>`,
  )
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

  // `link_to: url, title` plus Shopify's named attributes (`class: 'x'`), printed before `href`.
  add('link_to', (text: unknown, url: unknown, ...args: unknown[]) => {
    const { positional, named } = splitArgs(args)
    const title = positional[0]
    const attrs = Object.entries(named)
      .filter(([k]) => /^[\w-]+$/.test(k))
      .map(([k, v]) => ` ${k}="${escapeAttr(v)}"`)
      .join('')
    return `<a${attrs} href="${escapeAttr(url)}"${title ? ` title="${escapeAttr(title)}"` : ''}>${str(text)}</a>`
  })
  add('url_for_type', (type: unknown) => `/collections/types?q=${encodeURIComponent(str(type))}`)
  add('url_for_vendor', (v: unknown) => `/collections/vendors?q=${encodeURIComponent(str(v))}`)
  add(
    'link_to_type',
    (type: unknown) =>
      `<a href="/collections/types?q=${encodeURIComponent(str(type))}" title="${escapeAttr(type)}">${str(type)}</a>`,
  )
  add(
    'link_to_vendor',
    (v: unknown) =>
      `<a href="/collections/vendors?q=${encodeURIComponent(str(v))}" title="${escapeAttr(v)}">${str(v)}</a>`,
  )
  add(
    'link_to_tag',
    (label: unknown, tag: unknown) =>
      `<a href="?tag=${encodeURIComponent(str(tag))}" title="${escapeAttr(tag)}">${str(label)}</a>`,
  )
  add('within', (url: unknown, collection: unknown) => {
    const c = collection as { url?: string } | null
    return c?.url ? `${c.url}${str(url)}` : str(url)
  })
  add(
    'sort_by',
    (url: unknown, sort: unknown) => `${str(url)}?sort_by=${encodeURIComponent(str(sort))}`,
  )

  add('time_tag', (value: unknown, ...args: unknown[]) => {
    const date = value instanceof Date ? value : new Date(str(value))
    if (Number.isNaN(date.getTime())) return ''
    const text = formatInZone(date, { day: 'numeric', month: 'long', year: 'numeric' })
    const { named } = splitArgs(args)
    const datetime = named.datetime ? str(named.datetime) : date.toISOString()
    return `<time datetime="${escapeAttr(datetime)}">${text}</time>`
  })
  add('format_address', (address: unknown) => {
    if (!address || typeof address !== 'object') return ''
    const a = address as Record<string, unknown>
    const lines = [
      a.name,
      a.company,
      a.address1,
      a.address2,
      [a.city, a.province, a.zip].filter(Boolean).join(' '),
      a.country,
    ]
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
        v === 'bold' || v === 'bolder'
          ? Math.min(9, Math.max(w + 3, 7))
          : v === 'lighter'
            ? Math.max(1, w - 3)
            : v === 'normal'
              ? 4
              : /^[+-]\d+$/.test(v)
                ? w + Number(v) / 100
                : Number(v) / 100
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

  add('video_tag', (video: unknown, ...args: unknown[]) => videoTag(video, splitArgs(args).named))
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
  add('media_tag', (media: unknown, ...args: unknown[]) =>
    (media as { media_type?: string } | null)?.media_type === 'video'
      ? videoTag(media, splitArgs(args).named)
      : imageTag(media, {}),
  )
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
    const clock = value === 'now' || value === 'today'
    if (clock) noteClockRead(this)
    return (impl as (this: unknown, v: unknown, f: string) => unknown).call(
      this,
      clock ? new Date() : value,
      fmt,
    )
  })
}

export { escapeAttr, splitArgs, str as stringifyLiquid }
