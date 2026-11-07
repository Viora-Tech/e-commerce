/** SOURCE OF TRUTH: theme setting values for Liquid — WHAT: a stored setting turned into what the theme reads by its schema type (images, products, collections, menus, colours, schemes, fonts, videos, links) / WHY: themes read `section.settings.x` as Shopify's objects; this is the one place stored values become them */
import type { Context, Liquid } from 'liquidjs'
import type { MediaVariants } from '../media/loader'
import type { LiquidDataCache } from './cache'
import {
  ColorDrop,
  ColorSchemeDrop,
  FontDrop,
  imageDrop,
  type LiquidImageData,
  VideoDrop,
} from './drops'
import {
  ArticleDrop,
  BlogDrop,
  CollectionDrop,
  LinklistDrop,
  PageDrop,
  ProductDrop,
} from './resource-drops'
import { isValueSetting, type ShopifySetting, settingDefaults } from './schema'

/** Shopify's resource links (`shopify://collections/x`) as our paths. */
export function shopifyUrlToPath(value: string): string {
  const m = /^shopify:\/\/(products|collections|pages|blogs|articles|search|policies)\/?(.*)$/.exec(
    value,
  )
  if (!m) return value
  const [, kind, rest = ''] = m
  if (kind === 'search') return '/search'
  if (kind === 'policies') return `/policies/${rest}`
  if (kind === 'articles') return `/blogs/${rest}`
  return `/${kind}/${rest}`
}

/** A `video_url` setting: `{ type: 'youtube', id }`, printing as the URL. */
function videoUrl(value: string): Record<string, unknown> | null {
  if (!value) return null
  const yt = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/.exec(value)
  if (yt) return { type: 'youtube', id: yt[1], url: value }
  const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/.exec(value)
  if (vimeo) return { type: 'vimeo', id: vimeo[1], url: value }
  return { type: null, id: null, url: value }
}

/** A colour scheme's settings: hex strings become colour objects (`.rgb`, `.alpha`). */
const colourValues = (settings: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(settings).map(([k, v]) => [
      k,
      typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v) ? new ColorDrop(v) : v,
    ]),
  )

const handlesOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v !== '') : []

/**
 * A setting's stored value as the theme reads it: image settings become image
 * objects, product settings products, colours colour objects, and so on.
 */
export function liquidSettingValue(
  setting: ShopifySetting,
  value: unknown,
  data: LiquidDataCache,
  themeSettings: Record<string, unknown>,
): unknown {
  const text = typeof value === 'string' ? value : ''
  switch (setting.type) {
    case 'image_picker': {
      if (value && typeof value === 'object' && 'url' in value) {
        const v = value as {
          url: unknown
          alt?: unknown
          width?: unknown
          height?: unknown
          variants?: MediaVariants
        }
        return typeof v.url === 'string' && v.url && !v.url.startsWith('shopify://')
          ? imageDrop({
              url: v.url,
              alt: typeof v.alt === 'string' ? v.alt : '',
              width: typeof v.width === 'number' ? v.width : null,
              height: typeof v.height === 'number' ? v.height : null,
              variants: v.variants ?? undefined,
            })
          : null
      }
      return text && !text.startsWith('shopify://') ? imageDrop({ url: text }) : null
    }
    case 'product': {
      const found = text ? data.product(text) : null
      return found ? new ProductDrop(found, data) : null
    }
    case 'product_list':
      return handlesOf(value).flatMap((h) => {
        const p = data.product(h)
        return p ? [new ProductDrop(p, data)] : []
      })
    case 'collection': {
      const found = text ? data.collection(text) : null
      return found ? new CollectionDrop(found, data) : null
    }
    case 'collection_list':
      return handlesOf(value).flatMap((h) => {
        const c = data.collection(h)
        return c ? [new CollectionDrop(c, data)] : []
      })
    case 'link_list': {
      const menu = text ? data.menu(text) : null
      return menu ? new LinklistDrop(menu, data) : null
    }
    case 'blog': {
      const blog = text ? data.blog(text) : null
      return blog ? new BlogDrop(blog) : null
    }
    case 'article': {
      const [blogHandle, articleHandle] = text.split('/')
      const blog = blogHandle ? data.blog(blogHandle) : null
      const article = blog?.articles.find((a) => a.handle === articleHandle)
      return article ? new ArticleDrop(article) : null
    }
    case 'page': {
      const page = text ? data.page(text) : null
      return page ? new PageDrop(page) : null
    }
    case 'color':
      return text ? new ColorDrop(text) : null
    case 'color_scheme': {
      const schemes = (themeSettings.color_schemes ?? {}) as Record<
        string,
        { settings?: Record<string, unknown> }
      >
      const scheme = schemes[text]
      return scheme ? new ColorSchemeDrop(text, colourValues(scheme.settings ?? {})) : text
    }
    case 'color_scheme_group': {
      // Stored as `{ "scheme-1": { settings } }`; Liquid iterates it as a list of schemes.
      const groups = (value && typeof value === 'object' ? value : {}) as Record<
        string,
        { settings?: Record<string, unknown> }
      >
      return Object.entries(groups).map(
        ([id, scheme]) => new ColorSchemeDrop(id, colourValues(scheme.settings ?? {})),
      )
    }
    case 'font_picker':
      return text ? new FontDrop(text) : null
    case 'url':
      return text ? shopifyUrlToPath(text) : null
    case 'video_url':
      return videoUrl(text)
    case 'video': {
      const v = value as {
        url?: unknown
        mobileUrl?: unknown
        poster?: LiquidImageData | null
      } | null
      return v && typeof v === 'object' && typeof v.url === 'string' && v.url
        ? new VideoDrop({
            url: v.url,
            mobileUrl: typeof v.mobileUrl === 'string' && v.mobileUrl ? v.mobileUrl : null,
            poster: v.poster ?? null,
          })
        : null
    }
    case 'metaobject':
    case 'metaobject_list':
      return null
    default:
      return value
  }
}

/**
 * A setting connected to a resource, as Shopify's dynamic sources store it:
 * `{{ closest.product }}`, or `{{ closest.product.title }}` inside text.
 */
const DYNAMIC_SOURCE = /\{\{\s*(?:closest|product|collection|article|blog|page)\b/
const WHOLE_SOURCE = /^\s*\{\{\s*([^{}]+?)\s*\}\}\s*$/

export function isDynamicSource(value: unknown): value is string {
  return typeof value === 'string' && DYNAMIC_SOURCE.test(value) && !value.includes('{%')
}

/**
 * A block's settings with dynamic sources filled in for this render: a whole
 * `{{ closest.product }}` gives the resource itself, text with one inside gives text.
 */
export function dynamicSettings(
  settings: Record<string, unknown>,
  engine: Liquid,
  ctx: Context | Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...settings }
  for (const [key, value] of Object.entries(settings)) {
    if (!isDynamicSource(value)) continue
    const whole = WHOLE_SOURCE.exec(value)?.[1]
    out[key] = whole ? engine.evalValueSync(whole, ctx) : engine.parseAndRenderSync(value, ctx)
  }
  return out
}

/** Every setting a schema declares, defaults filled in, values typed for Liquid. */
export function liquidSettings(
  schema: ShopifySetting[] | undefined,
  values: Record<string, unknown>,
  data: LiquidDataCache,
  themeSettings: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...settingDefaults(schema), ...values }
  const out: Record<string, unknown> = { ...merged }
  for (const s of (schema ?? []).filter(isValueSetting)) {
    const value = merged[s.id]
    // Filled in per render (`dynamicSettings`): a product card reads its own product.
    if (!isDynamicSource(value)) out[s.id] = liquidSettingValue(s, value, data, themeSettings)
  }
  return out
}
