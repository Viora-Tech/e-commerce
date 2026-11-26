/**
 * SOURCE OF TRUTH KEYWORDS: theme stylesheet bundle, combined theme CSS, minify theme CSS
 * WHAT:  Two speed-ups for an imported theme's own CSS files (`/theme-assets/<theme>/<file>.css`):
 *        - `bundleThemeStylesheets`: in rendered HTML, every run of the theme's plain stylesheet
 *          links with no other CSS between them (no `<style>`, no other stylesheet) becomes one
 *          link to `~bundle.css?f=a.css,b.css&v=<hash>`, which the theme-assets route answers
 *          with the files joined in the same order.
 *        - `minifyCss`: comments and whitespace out, on serve.
 * WHY:   Since the 17 Nov CSS split (#1773) a Waimers page linked about 35 theme stylesheets,
 *        each its own request; the head's five were render-blocking (Lighthouse, 27 Nov), and
 *        the files were served as written (about 100 KiB of comments and indentation).
 * SAFE:  The cascade depends only on the order of the style sheets, never on where in the
 *        markup a link sits, so joining links that have no other CSS between them, in their
 *        order and keeping repeats, draws the page the same. A link with any other attribute
 *        (media other than all, onload, id, disabled, crossorigin...) is left alone and counts
 *        as other CSS. Links inside comments, scripts, `<template>`, `<noscript>` and other raw
 *        text are never touched. The bundle lives in the same folder as the files, so relative
 *        `url()`s resolve the same. Its version is a hash of each file's checksum, so the URL
 *        changes whenever any file does and can be cached for a year.
 * WHERE: `liquid-theme.ts` (the layout head, before the render cache), `plain-html/render.ts`
 *        (the whole plain page), `app/-s/[storeId]/theme-assets/[themeId]/[file]/route.ts`.
 */
import { createHash } from 'node:crypto'

/** The bundle's file name inside a theme's assets folder. `~` is never in a Shopify asset name. */
export const BUNDLE_FILE = '~bundle.css'

/** At most this many files in one bundle (keeps the URL short); a longer run is split. */
export const MAX_BUNDLE_FILES = 40

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const THEME_CSS_HREF = new RegExp(`^/theme-assets/(${UUID})/([^/?#]+\\.css)\\?v=([\\w-]+)$`, 'i')

/** Elements whose content is text, not markup: a `<link>` inside is never a link. */
const RAW = ['script', 'style', 'textarea', 'title', 'noscript', 'xmp', 'template', 'iframe']

type Part = { themeId: string; file: string; version: string }

/** The bundle's version for these parts: a short hash of each file and its checksum. */
export function bundleVersion(parts: readonly Pick<Part, 'file' | 'version'>[]): string {
  const hash = createHash('sha256')
  for (const p of parts) hash.update(`${p.file}:${p.version}\n`)
  return hash.digest('base64url').slice(0, 12)
}

/** The bundle link for a run of the theme's stylesheet links. */
function bundleLink(parts: readonly Part[]): string {
  const themeId = parts[0]?.themeId ?? ''
  const files = parts.map((p) => encodeURIComponent(p.file)).join(',')
  return `<link rel="stylesheet" href="/theme-assets/${themeId}/${BUNDLE_FILE}?f=${files}&amp;v=${bundleVersion(parts)}">`
}

const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

/** A tag's attributes, names lowercased. */
function attributesOf(tag: string): Map<string, string> {
  const out = new Map<string, string>()
  const body = tag.replace(/^<[a-z]+/i, '').replace(/\/?>$/, '')
  for (const m of body.matchAll(/([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    const name = (m[1] ?? '').toLowerCase()
    if (!out.has(name)) out.set(name, decodeEntities(m[2] ?? m[3] ?? m[4] ?? ''))
  }
  return out
}

/** A `<link>` tag that can join a bundle: a plain theme stylesheet, for all media. */
function bundlePart(tag: string): Part | null {
  const attrs = attributesOf(tag)
  if ((attrs.get('rel') ?? '').trim().toLowerCase() !== 'stylesheet') return null
  for (const name of attrs.keys()) {
    if (name !== 'rel' && name !== 'href' && name !== 'type' && name !== 'media') return null
  }
  const type = (attrs.get('type') ?? 'text/css').trim().toLowerCase()
  const media = (attrs.get('media') ?? 'all').trim().toLowerCase()
  if (type !== 'text/css' || (media !== 'all' && media !== '')) return null
  const m = THEME_CSS_HREF.exec((attrs.get('href') ?? '').trim())
  if (!m) return null
  return { themeId: (m[1] ?? '').toLowerCase(), file: m[2] ?? '', version: m[3] ?? '' }
}

const isStylesheet = (tag: string) =>
  /^<link\b/i.test(tag) && /\brel\s*=\s*["']?[^"'>]*\bstylesheet\b/i.test(tag)

type Run = { parts: Part[]; spans: { start: number; end: number }[] }

/**
 * `html` with each run of the theme's plain stylesheet links (no other CSS between them) as one
 * bundle link at the run's first link. A run of one is left as it is. See the header comment.
 */
export function bundleThemeStylesheets(html: string): string {
  const runs: Run[] = []
  let run: Run | null = null
  const close = () => {
    if (run && run.parts.length > 1) runs.push(run)
    run = null
  }

  let i = 0
  while (i < html.length) {
    const lt = html.indexOf('<', i)
    if (lt === -1) break
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4)
      i = end === -1 ? html.length : end + 3
      continue
    }
    const gt = tagEnd(html, lt)
    if (gt === -1) break
    const tag = html.slice(lt, gt)
    const name = /^<([a-z][a-z0-9-]*)/i.exec(tag)?.[1]?.toLowerCase()
    i = gt
    if (!name) continue
    if (name === 'style') close()
    if (RAW.includes(name)) {
      const closer = new RegExp(`</${name}`, 'gi')
      closer.lastIndex = gt
      const closeAt = closer.exec(html)?.index ?? -1
      i = closeAt === -1 ? html.length : closeAt
      continue
    }
    if (name !== 'link' || !isStylesheet(tag)) continue
    const part = bundlePart(tag)
    const current: Run | null = run
    if (
      !part ||
      (current &&
        (current.parts[0]?.themeId !== part.themeId || current.parts.length >= MAX_BUNDLE_FILES))
    ) {
      close()
      if (!part) continue
    }
    if (!run) run = { parts: [], spans: [] }
    run.parts.push(part)
    run.spans.push({ start: lt, end: gt })
  }
  close()
  if (!runs.length) return html

  let out = ''
  let at = 0
  for (const r of runs) {
    r.spans.forEach((span, n) => {
      out += html.slice(at, span.start)
      if (n === 0) out += bundleLink(r.parts)
      at = span.end
    })
  }
  return out + html.slice(at)
}

/** The index after the `>` that closes the tag opening at `start` (quotes respected), or -1. */
function tagEnd(html: string, start: number): number {
  let quote = ''
  for (let i = start + 1; i < html.length; i++) {
    const c = html[i]
    if (quote) {
      if (c === quote) quote = ''
    } else if (c === '"' || c === "'") {
      if (html[i - 1] === '=' || /\s/.test(html[i - 1] ?? '')) quote = c
    } else if (c === '>') {
      return i + 1
    }
  }
  return -1
}

/** The files a bundle request names, in order; null when the list is not a valid one. */
export function bundleFiles(list: string | null): string[] | null {
  if (!list) return null
  const files = list.split(',').map((f) => {
    try {
      return decodeURIComponent(f)
    } catch {
      return ''
    }
  })
  if (!files.length || files.length > MAX_BUNDLE_FILES) return null
  for (const f of files) {
    if (!f.endsWith('.css') || f.includes('/') || f.includes('..') || f.includes('\0')) return null
  }
  return files
}

/**
 * The bundle's body: the files' CSS joined in order. `@charset` goes (the response is UTF-8);
 * an `@import` that a later file starts with moves to the top, where CSS only allows it.
 */
export function joinCss(files: readonly string[]): string {
  const imports: string[] = []
  const bodies = files.map((css, n) =>
    css
      .replace(/@charset\s+["'][^"']*["']\s*;/gi, '')
      .replace(/@import\s+(?:url\([^)]*\)|"[^"]*"|'[^']*')[^;]*;/gi, (rule) => {
        if (n === 0) return rule
        imports.push(rule)
        return ''
      }),
  )
  return [...imports, ...bodies].join('\n')
}

/**
 * CSS with its comments out and its whitespace shrunk: runs of whitespace become one space, and
 * none is kept next to `{`, `}`, `;` or after `,` and `:`. Strings and `url()`s are copied as
 * they are; spaces inside values (`calc(1px + 2px)`) and selectors (`a :hover`) stay one space.
 * Conservative by design: nothing is reordered or merged.
 */
export function minifyCss(css: string): string {
  let out = ''
  let pendingSpace = false
  // A space that stood before `s` stays one space, unless it follows `{`, `}`, `;`, `,` or `:`
  // (a space after a colon never matters: `a: hover` is no selector, `--x: y` is trimmed).
  const push = (s: string) => {
    const last = out[out.length - 1] ?? ''
    if (pendingSpace && out && !'{};,:'.includes(last)) out += ' '
    pendingSpace = false
    out += s
  }
  for (let i = 0; i < css.length; ) {
    const c = css[i] as string
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      // A comment is nothing (not whitespace) between the tokens around it.
      i = end === -1 ? css.length : end + 2
      // ... unless dropping it would glue two names into one (`a/**/b`): keep an empty one.
      if (!pendingSpace && /[\w-]$/.test(out) && /[\w-]/.test(css[i] ?? '')) out += '/**/'
      continue
    }
    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < css.length && css[j] !== c) {
        if (css[j] === '\\') j++
        if (css[j] === '\n') break
        j++
      }
      push(css.slice(i, j + 1))
      i = j + 1
      continue
    }
    if (/\s/.test(c)) {
      while (i < css.length && /\s/.test(css[i] as string)) i++
      pendingSpace = true
      continue
    }
    if ((c === 'u' || c === 'U') && /^url\(/i.test(css.slice(i, i + 4))) {
      // An unquoted url() may hold characters that look like comments or quotes.
      const end = css.indexOf(')', i)
      const inner = css.slice(i + 4, end === -1 ? css.length : end).trim()
      if (!inner.startsWith('"') && !inner.startsWith("'")) {
        push(css.slice(i, end === -1 ? css.length : end + 1))
        i = end === -1 ? css.length : end + 1
        continue
      }
    }
    if (c === '{' || c === '}' || c === ';' || c === ',') {
      // `--x: ;` (a custom property set to a space) is valid where `--x:;` once was not.
      if (pendingSpace && out.endsWith(':')) out += ' '
      pendingSpace = false
      out += c
      i++
      continue
    }
    push(c)
    i++
  }
  return out.trim()
}
