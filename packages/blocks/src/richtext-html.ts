import sanitizeHtml from 'sanitize-html'
import { asLexical, lexicalToHtml } from './lexical-html'

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

/** Same test Puck's richtext field uses to decide a stored string is HTML, not plain text. */
const HTML_RE = /<\/?[a-z][\s\S]*>/i

/** Whether a stored value is Puck richtext HTML (true) or a legacy plain string (false). */
function isRichtextHtml(value: string): boolean {
  return HTML_RE.test(value)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** A legacy plain string as richtext HTML: blank lines split paragraphs, single newlines break. */
function plainToRichtextHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/** Any stored body-copy value as sanitised HTML; empty string for nothing to show. */
export function richtextHtml(value: unknown): string {
  const lexical = asLexical(value)
  if (lexical) return sanitizeHtml(lexicalToHtml(lexical), OPTIONS)
  if (typeof value !== 'string' || !value.trim()) return ''
  if (!isRichtextHtml(value)) return plainToRichtextHtml(value)
  return sanitizeHtml(value, OPTIONS)
}
