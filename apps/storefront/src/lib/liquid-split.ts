import 'server-only'
import { loadEnv } from '@commerce/config'
import type { TemplateKey } from '@commerce/core'
import { crawlerRequest } from './flight-request'
import { DEFAULT_EAGER_SECTIONS } from './liquid-fold'
import { type LiquidPart, WHOLE_TEMPLATE } from './liquid-theme'

/** How long the later sections may take and still be drawn in place rather than streamed. */
export const STREAM_GRACE_MS = 25

let eagerSections: number | undefined

/** How many sections of a page are sent first and drawn as the theme wrote them. */
function eagerSectionCount(): number {
  eagerSections ??= loadEnv(process.env).STOREFRONT_EAGER_SECTIONS ?? DEFAULT_EAGER_SECTIONS
  return eagerSections
}

/**
 * Where an imported theme's page splits: the sections before `fold` are rendered before the
 * page starts streaming; the rest, when their render is slow (a cache miss), stream in behind a
 * Suspense boundary in the same response (`streamFrom`) while the browser is already painting
 * the first ones. Crawlers get every section in place, in one piece. The header and footer
 * groups and a theme preview are never split.
 */
export async function liquidSplit(
  key: TemplateKey,
  preview: boolean,
): Promise<LiquidPart & { streamFrom: number }> {
  if (preview || key === 'header' || key === 'footer') {
    return { ...WHOLE_TEMPLATE, streamFrom: Infinity }
  }
  const fold = eagerSectionCount()
  return { start: 0, end: Infinity, fold, streamFrom: (await crawlerRequest()) ? Infinity : fold }
}

/** Whether `promise` settles (either way) within `ms`. */
export function settlesWithin(promise: Promise<unknown>, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms)
    const settled = () => {
      clearTimeout(timer)
      resolve(true)
    }
    promise.then(settled, settled)
  })
}
