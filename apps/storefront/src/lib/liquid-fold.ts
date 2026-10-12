/**
 * An imported theme's sections below the fold, made to wait for the shopper. The first few
 * sections of a page (`STOREFRONT_EAGER_SECTIONS`, default 3) are left exactly as the theme
 * wrote them; for every section after them:
 *
 * - images and iframes load lazily: `loading="lazy"` added, `loading="eager"` and
 *   `fetchpriority="high"` taken away (themes often mark a whole logo wall or gallery eager,
 *   which competes with the hero for the first second of bandwidth);
 * - videos fetch nothing up front (`preload="none"`); an autoplaying one starts when it nears
 *   the viewport instead (`data-theme-autoplay`, played by the shim, `lib/liquid-shim.ts`);
 * - the section's parked scripts (`lib/liquid-defer.ts`) run when the section nears the
 *   viewport rather than all at once after hydration (`data-theme-near`).
 *
 * Pure string work on the rendered HTML, applied before the render is cached.
 */

import { DEFERRED_TYPE } from './liquid-defer'

/** How many sections a page draws as the theme wrote them, when nothing configures it. */
export const DEFAULT_EAGER_SECTIONS = 3

/** An opening tag; quoted attribute values may hold `>`. Group 1 is the name, 2 the attributes. */
const tag = (names: string) =>
  new RegExp(`<(${names})\\b((?:[^>"']|"[^"]*"|'[^']*')*?)\\s*/?>`, 'gi')

const MEDIA = tag('img|iframe|video')
const SCRIPT = tag('script')

/** One attribute as written: its lower-cased name and its raw text (`name` or `name="value"`). */
const ATTR = /([^\s=/>]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?/g

type Attr = { name: string; raw: string }

function attributes(source: string): Attr[] {
  return [...source.matchAll(ATTR)].map((m) => ({ name: (m[1] ?? '').toLowerCase(), raw: m[0] }))
}

function openTag(name: string, attrs: Attr[]): string {
  return `<${name}${attrs.map((a) => ` ${a.raw}`).join('')}>`
}

const without = (attrs: Attr[], ...names: string[]) => attrs.filter((a) => !names.includes(a.name))
const hasAttr = (attrs: Attr[], name: string) => attrs.some((a) => a.name === name)
const plain = (raw: string): Attr => ({ name: raw.split('=')[0] ?? raw, raw })

function quietMedia(_whole: string, name: string, source: string): string {
  const attrs = attributes(source)
  if (name.toLowerCase() !== 'video') {
    return openTag(name, [...without(attrs, 'loading', 'fetchpriority'), plain('loading="lazy"')])
  }
  const autoplay = hasAttr(attrs, 'autoplay')
  return openTag(name, [
    ...without(attrs, 'autoplay', 'preload'),
    plain('preload="none"'),
    ...(autoplay ? [plain('data-theme-autoplay')] : []),
  ])
}

function nearScript(whole: string, name: string, source: string): string {
  const attrs = attributes(source)
  const parked = attrs.some((a) => a.name === 'type' && a.raw.includes(DEFERRED_TYPE))
  if (!parked || hasAttr(attrs, 'data-theme-near')) return whole
  return openTag(name, [...attrs, plain('data-theme-near')])
}

/** A below-the-fold section's HTML, with its media and scripts waiting for the shopper. */
export function belowTheFold(html: string): string {
  return html.replace(MEDIA, quietMedia).replace(SCRIPT, nearScript)
}
