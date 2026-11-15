/**
 * SOURCE OF TRUTH KEYWORDS: storedRichtextHtml, setRichtextSanitizer, plainToRichtextHtml
 * WHAT:  The parts of body-copy rendering that need no HTML parser: the legacy plain-string
 *        migration (escaped, split into paragraphs) and the hook `./richtext-html.ts` fills
 *        with its sanitize-html allow-list when a bundle loads it.
 * WHY:   `components/rich-copy.tsx` is drawn by client components too; importing sanitize-html
 *        from it put the library and its parser (about 65 kB gzip) on every storefront page.
 *        The storefront sanitises on the server instead (`./richtext-node.ts`, `framed`) and
 *        hands client components the sanitised HTML; only server code, the admin and the Hono
 *        island load `./richtext-html.ts`.
 * WHERE: `components/rich-copy.tsx`; `./richtext-html.ts` registers the sanitiser.
 */

/** Same test Puck's richtext field uses to decide a stored string is HTML, not plain text. */
const HTML_RE = /<\/?[a-z][\s\S]*>/i

/** Whether a stored value is Puck richtext HTML (true) or a legacy plain string (false). */
export function isRichtextHtml(value: string): boolean {
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
export function plainToRichtextHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

let sanitizer: ((value: unknown) => string) | null = null

/** Called once by `./richtext-html.ts` when it loads: from then on stored copy is sanitised. */
export function setRichtextSanitizer(sanitize: (value: unknown) => string): void {
  sanitizer = sanitize
}

/**
 * A stored body-copy value (HTML, a legacy plain string, Lexical JSON) as safe HTML. Where the
 * sanitiser is loaded this is `richtextHtml`. Where it is not (the storefront's browser bundle,
 * which gets sanitised HTML from the server), stored HTML is never trusted: its text is shown,
 * escaped, so a value the server did not prepare can only lose its formatting.
 */
export function storedRichtextHtml(value: unknown): string {
  if (sanitizer) return sanitizer(value)
  if (typeof value !== 'string' || !value.trim()) return ''
  return plainToRichtextHtml(isRichtextHtml(value) ? value.replace(/<[^>]*>/g, ' ') : value)
}
