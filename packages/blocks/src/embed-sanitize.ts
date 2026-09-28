import sanitizeHtml from 'sanitize-html'

/**
 * The Custom HTML / Embed element's allow-list, run with `sanitize-html` (MIT,
 * see THIRD_PARTY_NOTICES.md) wherever that HTML is stored or drawn: when a
 * template is saved (API), when the storefront renders it (server), and in the
 * editor preview (which shares the admin's origin, so it must never run a
 * merchant's script either).
 *
 * What survives: text formatting, lists, tables, links, images and iframes
 * from YouTube, Vimeo and Instagram. What never does: `<script>`, `<style>`,
 * `<svg>`, forms, `on*` handlers, `style` attributes (no CSS-based data
 * exfiltration), `javascript:`/`data:` URLs, protocol-relative URLs and ids
 * (no DOM clobbering). Every iframe is sandboxed and lazy.
 */

/** Longest HTML one element may hold, before sanitising. */
export const EMBED_MAX_LENGTH = 20_000

/** Where an iframe may point: host plus the path its embeds live under. */
const IFRAME_SOURCES: { host: string; path: RegExp }[] = [
  { host: 'www.youtube.com', path: /^\/embed\/[\w-]{6,20}$/ },
  { host: 'www.youtube-nocookie.com', path: /^\/embed\/[\w-]{6,20}$/ },
  { host: 'player.vimeo.com', path: /^\/video\/\d{1,12}$/ },
  { host: 'www.instagram.com', path: /^\/(p|reel|tv)\/[\w-]{4,40}\/embed\/?$/ },
]

/** The iframe hosts the Embed element accepts, for copy and docs. */
export const EMBED_IFRAME_HOSTS = IFRAME_SOURCES.map((s) => s.host)

/** Sandbox every allowed embed gets: enough for a player, nothing reaching our page. */
export const EMBED_SANDBOX =
  'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox'

/** Whether an iframe `src` is on the allow-list (https, known host, known embed path). */
export function isAllowedEmbedSrc(src: string): boolean {
  let url: URL
  try {
    url = new URL(src)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false
  return IFRAME_SOURCES.some((s) => s.host === url.hostname && s.path.test(url.pathname))
}

const TEXT_TAGS = [
  'p',
  'br',
  'span',
  'div',
  'section',
  'article',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'small',
  'sub',
  'sup',
  'mark',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'q',
  'cite',
  'code',
  'pre',
  'hr',
  'figure',
  'figcaption',
  'details',
  'summary',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
]

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...TEXT_TAGS, 'a', 'img', 'iframe'],
  // Anything else goes, content and all, for these; other unknown tags keep their text.
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'svg', 'math', 'template'],
  disallowedTagsMode: 'discard',
  allowedAttributes: {
    '*': ['class', 'title', 'lang', 'dir', 'aria-label', 'aria-hidden'],
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'loading', 'decoding'],
    iframe: [
      'src',
      'width',
      'height',
      'allow',
      'allowfullscreen',
      'loading',
      'sandbox',
      'referrerpolicy',
    ],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan', 'scope'],
    ol: ['start', 'reversed'],
  },
  allowedSchemes: ['https', 'http', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['https'], iframe: ['https'] },
  allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
  allowProtocolRelative: false,
  allowedIframeHostnames: EMBED_IFRAME_HOSTS,
  allowIframeRelativeUrls: false,
  // No `style` attribute anywhere, so no CSS parsing is needed at all.
  parseStyleAttributes: false,
  transformTags: {
    a: (tagName, attribs) => {
      const out: Record<string, string> = { ...attribs }
      if (out.target === '_blank') out.rel = 'noopener noreferrer'
      else delete out.target
      return { tagName, attribs: out }
    },
    iframe: (tagName, attribs) => {
      const src = attribs.src ?? ''
      const allowed = isAllowedEmbedSrc(src)
      return {
        tagName,
        attribs: {
          ...(allowed ? { src } : {}),
          ...(attribs.title ? { title: attribs.title } : {}),
          ...(attribs.width ? { width: attribs.width } : {}),
          ...(attribs.height ? { height: attribs.height } : {}),
          allow: 'encrypted-media; picture-in-picture; fullscreen',
          allowfullscreen: '',
          loading: 'lazy',
          sandbox: EMBED_SANDBOX,
          referrerpolicy: 'strict-origin-when-cross-origin',
        },
      }
    },
    img: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, loading: 'lazy', decoding: 'async' },
    }),
  },
  // An iframe whose source was refused is dropped rather than left as an empty box.
  exclusiveFilter: (frame) => frame.tag === 'iframe' && !frame.attribs.src,
}

/**
 * Merchant HTML made safe to render: the allow-list above, over at most
 * `EMBED_MAX_LENGTH` characters. Idempotent, so sanitising on save and again
 * on render is harmless.
 */
export function sanitizeEmbedHtml(html: unknown): string {
  if (typeof html !== 'string' || !html.trim()) return ''
  return sanitizeHtml(html.slice(0, EMBED_MAX_LENGTH), OPTIONS).trim()
}
