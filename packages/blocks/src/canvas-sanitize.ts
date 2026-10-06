import sanitizeHtml from 'sanitize-html'

/**
 * Imported Shopify theme markup for the Customize canvas, run through `sanitize-html` (MIT,
 * see THIRD_PARTY_NOTICES.md). The canvas is an iframe on the admin's own origin, so
 * nothing in a theme may run there: the storefront runs the theme's scripts, the canvas
 * only shows its look.
 *
 * Unlike the Custom HTML allow-list (`embed-sanitize.ts`) this keeps every element and
 * attribute a theme uses for its look (custom elements, SVG sprites, `style`, `class`,
 * `data-*`) and removes only what can act: script and plugin elements, frames, `<meta>`
 * (refresh) and `<base>`, every `on*` handler however it is quoted, and `javascript:` and
 * other non-web URLs in any URL attribute (SVG animations of a URL attribute included).
 * The admin's script CSP blocks the same things again in a browser that supports it.
 */

/** Elements dropped with everything inside them. */
const DROPPED = new Set([
  'script',
  'noscript',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'portal',
  'base',
  'meta',
  'handler',
  'listener',
])

/**
 * Elements whose content the sanitiser reads as plain text, while a browser inside `<svg>`
 * or `<math>` reads it as markup (`<svg><style><img onerror=…>`). Any of them holding a `<`
 * is dropped, so text kept here can never turn back into an element. Real theme CSS has
 * no `<`.
 */
const RAW_TEXT = new Set(['style', 'title', 'textarea', 'xmp', 'noembed', 'noframes', 'plaintext'])

/** Every attribute except event handlers (`onclick`, `ONERROR`, `onpointerdown`...). */
function withoutHandlers(attribs: sanitizeHtml.Attributes): sanitizeHtml.Attributes {
  const out: sanitizeHtml.Attributes = {}
  for (const [name, value] of Object.entries(attribs)) {
    if (/^on/i.test(name) || name.toLowerCase() === 'srcdoc') continue
    out[name] = value
  }
  return out
}

export function sanitizeCanvasHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: false,
    allowedAttributes: false,
    allowVulnerableTags: true,
    parseStyleAttributes: false,
    exclusiveFilter: (frame) => {
      const tag = frame.tag.toLowerCase()
      return DROPPED.has(tag) || (RAW_TEXT.has(tag) && frame.text.includes('<'))
    },
    transformTags: {
      '*': (tagName, attribs) => ({ tagName, attribs: withoutHandlers(attribs) }),
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    // Lazy-load placeholders and inline images are data URLs; they never run.
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'],
      source: ['http', 'https', 'data'],
      image: ['http', 'https', 'data'],
    },
    allowProtocolRelative: true,
  })
}
