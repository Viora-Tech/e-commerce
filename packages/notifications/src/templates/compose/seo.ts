import type { EmailBlock } from '../../emails/blocks'
import type { SeoWeeklyMover } from '../../seo-weekly-types'
import type { TemplateId } from '../../types'
import { seoWeeklyWords as w } from '../content-seo'
import type { Composer } from './index'
import { button, present } from './order'

/**
 * The weekly SEO email, from shared blocks: the 28-day clicks and views, the pages that moved
 * up and down (each a facts card), the top three suggestions, one button to the admin.
 */
function movers(title: string, list: SeoWeeklyMover[]): EmailBlock[] {
  if (list.length === 0) return []
  return [
    { kind: 'divider', label: title },
    {
      kind: 'facts',
      rows: list.map((m) => ({ label: m.title, value: w.move(m.from, m.to) })),
    },
  ]
}

const seoWeekly: Composer = (d, action) => {
  const s = d.seoWeekly
  if (!s) return { eyebrow: w.kicker, blocks: present([button(action)]) }
  const quiet = s.up.length + s.down.length === 0
  return {
    eyebrow: w.kicker,
    blocks: present([
      {
        kind: 'stats',
        items: [
          { label: `${w.clicks} ${w.last28}`, value: s.clicksLabel, tone: 'accent' },
          { label: `${w.impressions} ${w.last28}`, value: s.impressionsLabel },
        ],
      },
      quiet ? { kind: 'text', text: w.quiet } : null,
      ...movers(w.movedUp, s.up),
      ...movers(w.movedDown, s.down),
      ...(s.suggestions.length
        ? ([
            { kind: 'divider', label: w.tryNext },
            {
              kind: 'facts',
              look: 'soft',
              rows: s.suggestions.map((x) => ({ label: x.title, value: w.suggestion(x) })),
            },
          ] satisfies EmailBlock[])
        : []),
      button(action),
      { kind: 'text', muted: true, text: s.sinceLastWeek ? w.vsLastWeek : w.vsBefore },
    ]),
  }
}

export const seoComposers: Partial<Record<TemplateId, Composer>> = {
  staff_seo_weekly: seoWeekly,
}
