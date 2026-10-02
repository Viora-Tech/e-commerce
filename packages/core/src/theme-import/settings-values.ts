/** SOURCE OF TRUTH: theme setting values for Liquid — WHAT: a stored setting turned into what the theme reads by its schema type (images, products, collections, menus, colours, schemes, fonts, videos, links) / WHY: themes read `section.settings.x` as Shopify's objects; this is the one place stored values become them */
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
        const v = value as { url: unknown; alt?: unknown; width?: unknown; height?: unknown }
        return typeof v.url === 'string' && v.url && !v.url.startsWith('shopify://')
          ? imageDrop({
              url: v.url,
              alt: typeof v.alt === 'string' ? v.alt : '',
              width: typeof v.width === 'number' ? v.width : null,
              height: typeof v.height === 'number' ? v.height : null,
            })
          : null
      }
      return text && !text.startsWith('shopify://') ? imageDrop({ url: text }) : null
    }
    case 'product': {
      const found = text ? data.product(text) : null
      return found ? new ProductDrop(found) : null
    }
    case 'product_list':
      return handlesOf(value).flatMap((h) => {
        const p = data.product(h)
        return p ? [new ProductDrop(p)] : []
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
      return menu ? new LinklistDrop(menu) : null
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
      const v = value as { url?: unknown; poster?: LiquidImageData | null } | null
      return v && typeof v === 'object' && typeof v.url === 'string' && v.url
        ? new VideoDrop({ url: v.url, poster: v.poster ?? null })
        : null
    }
    case 'metaobject':
    case 'metaobject_list':
      return null
    default:
      return value
  }
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
    out[s.id] = liquidSettingValue(s, merged[s.id], data, themeSettings)
  }
  return out
}
