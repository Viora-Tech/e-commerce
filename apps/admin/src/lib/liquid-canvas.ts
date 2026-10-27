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
  /** Unsaved Theme settings to render with (empty: the saved ones). */
  themeSettings: Record<string, unknown>
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
  // One request per theme and set of unsaved Theme settings.
  const byTheme = new Map<string, Ask[]>()
  for (const ask of asks) {
    const group = `${ask.themeId}|${JSON.stringify(ask.themeSettings)}`
    byTheme.set(group, [...(byTheme.get(group) ?? []), ask])
  }
  for (const list of byTheme.values()) {
    const first = list[0]
    if (!first) continue
    const { themeId, themeSettings } = first
    const draft = Object.keys(themeSettings).length ? { themeSettings } : {}
    for (let i = 0; i < list.length; i += BATCH) {
      const chunk = list.slice(i, i + BATCH)
      // The latest ask per section wins; earlier ones get the same answer.
      const sections = [...new Map(chunk.map((a) => [a.section.id, a.section])).values()]
      try {
        const html = await api.themes.import.render({ themeId, sections, ...draft })
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
  themeSettings: Record<string, unknown> = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    queue.push({ themeId, section, themeSettings, resolve, reject })
    if (!scheduled) {
      scheduled = true
      setTimeout(() => void flush(), WINDOW_MS)
    }
  })
}
