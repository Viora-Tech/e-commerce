import sanitizeHtml from 'sanitize-html'
import { asLexical, lexicalToHtml } from './lexical-html'
import { isRichtextHtml, plainToRichtextHtml, setRichtextSanitizer } from './richtext-text'

/**
 * SOURCE OF TRUTH KEYWORDS: richtextHtml, isRichtextHtml, RICHTEXT_TAGS, inline copy, Puck richtext
 * WHAT:  The stored format of section body copy edited with Puck's `richtext` field (an HTML
 *        string from its Tiptap editor), and the one function that turns any stored value into
 *        safe HTML for the storefront.
 * WHY:   Older theme docs hold plain strings in the same props (they were `text`/`textarea`
 *        fields). `richtextHtml` migrates them on read: escaped and split into paragraphs, the
 *        way Puck's own editor reads a tag-free string, so nothing is rewritten in the database
 *        and a saved section keeps rendering. Copy saved by the retired Lexical field (JSON) is
 *        read too, through `./lexical-html.ts`. HTML is always run through a small allow-list
 *        (inline marks, paragraphs, short headings, quotes, lists, links): the storefront draws sections outside Puck's
 *        `<Render>`, so this is the only place merchant HTML is checked before it is shown.
 *        Deliberately narrower than the Embed element's list (`./embed-sanitize.ts`).
 *        Server only on the storefront: loading this module registers the sanitiser for
 *        `components/rich-copy.tsx` (`./richtext-text.ts`), and client components get the
 *        sanitised HTML from the server (`./richtext-node.ts`), so the browser never loads it.
 * WHERE: `components/rich-copy.tsx` renders it; `sections/inline-fields.ts` declares the field.
 */

/**
 * Tags the Puck richtext menu can produce (B/I/U, lists, links, line breaks), plus the
 * headings, quotes, rules and images the long-form fields (`inlineRichtextLong`) allow.
 */
const RICHTEXT_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'a',
  'ul',
  'ol',
  'li',
  'h2',
  'h3',
  'h4',
  'blockquote',
  'hr',
  'img',
]

/** An absolute http(s) URL or a root-relative path (not protocol-relative `//`). */
const IMAGE_SRC = /^(https?:\/\/|\/(?!\/))/i

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: RICHTEXT_TAGS,
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'loading', 'decoding'],
  },
  allowedSchemes: ['https', 'http', 'mailto', 'tel'],
  // Images load from http(s) or our own root-relative media paths; never data:, other schemes
  // or a bare relative path.
  allowedSchemesByTag: { img: ['https', 'http'] },
  exclusiveFilter: (frame) => frame.tag === 'img' && !IMAGE_SRC.test(frame.attribs.src ?? ''),
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        ...(attribs.target === '_blank' ? { rel: 'noopener noreferrer' } : {}),
      },
    }),
    img: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, loading: 'lazy', decoding: 'async' },
    }),
  },
}

/** Any stored body-copy value as sanitised HTML; empty string for nothing to show. */
export function richtextHtml(value: unknown): string {
  const lexical = asLexical(value)
  if (lexical) return sanitizeHtml(lexicalToHtml(lexical), OPTIONS)
  if (typeof value !== 'string' || !value.trim()) return ''
  if (!isRichtextHtml(value)) return plainToRichtextHtml(value)
  return sanitizeHtml(value, OPTIONS)
}

// RichCopy sanitises with this wherever this module is loaded (server, admin, Hono island).
setRichtextSanitizer(richtextHtml)
