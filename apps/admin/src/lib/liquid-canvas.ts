import type { LiquidSectionPlacement } from '@commerce/core/theme-import'
import { api } from './api-client'

/**
 * Renders imported Shopify sections for the Customize canvas through
 * `themes.import.render`. Sections ask one at a time as they mount or change; asks made
 * within a short window go to the server together, so opening a 20-section home page
 * costs one request, not twenty.
 */

type Ask = {
  themeId: string
  section: LiquidSectionPlacement
  resolve: (html: string) => void
  reject: (err: unknown) => void
}

const WINDOW_MS = 40
/** The API takes up to 60 sections per call. */
const BATCH = 60

let queue: Ask[] = []
let scheduled = false

async function flush(): Promise<void> {
  scheduled = false
  const asks = queue
  queue = []
  const byTheme = new Map<string, Ask[]>()
  for (const ask of asks) byTheme.set(ask.themeId, [...(byTheme.get(ask.themeId) ?? []), ask])
  for (const [themeId, list] of byTheme) {
    for (let i = 0; i < list.length; i += BATCH) {
      const chunk = list.slice(i, i + BATCH)
      // The latest ask per section wins; earlier ones get the same answer.
      const sections = [...new Map(chunk.map((a) => [a.section.id, a.section])).values()]
      try {
        const html = await api.themes.import.render({ themeId, sections })
        for (const a of chunk) a.resolve(html[a.section.id] ?? '')
      } catch (err) {
        for (const a of chunk) a.reject(err)
      }
    }
  }
}

/** The canvas HTML of one imported section (scripts removed by the server). */
export function renderLiquidCanvas(
  themeId: string,
  section: LiquidSectionPlacement,
): Promise<string> {
  return new Promise((resolve, reject) => {
    queue.push({ themeId, section, resolve, reject })
    if (!scheduled) {
      scheduled = true
      setTimeout(() => void flush(), WINDOW_MS)
    }
  })
}
