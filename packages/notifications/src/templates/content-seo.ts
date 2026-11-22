import type { SeoWeeklySuggestion } from '../seo-weekly-types'
import type { TemplateData } from '../types'
import type { TemplateCopy } from './content-parts'

/**
 * The weekly SEO email to the store owner (Google Search Console connected): the subject, the
 * plain-text part and the words its blocks show. Like every email word, English only.
 */
const pos = (n: number): string => (Math.round(n * 10) / 10).toFixed(1)

export const seoWeeklyWords = {
  kicker: 'Weekly SEO',
  clicks: 'Clicks from Google',
  impressions: 'Times Google showed you',
  last28: '(last 28 days)',
  movedUp: 'Moved up',
  movedDown: 'Moved down',
  tryNext: 'Try these next',
  move: (from: number, to: number) => `Position ${pos(from)} → ${pos(to)}`,
  suggestion: (s: SeoWeeklySuggestion): string => {
    const seen = `Seen ${s.impressions.toLocaleString('en-IN')} times at position ${pos(s.position)}`
    const query = s.topQuery ? ` for “${s.topQuery}”` : ''
    const ask =
      s.kind === 'title'
        ? 'Rewrite its search title.'
        : s.kind === 'description'
          ? 'Rewrite its search description.'
          : 'Add a short intro or FAQ that answers the search.'
    return `${seen}${query}. ${ask}`
  },
  quiet: 'No big moves this week. Your search listings held steady.',
  vsLastWeek: 'Moves are against last week.',
  vsBefore: 'First weekly email: moves are against the 28 days before.',
}

const lead = (d: TemplateData): string => {
  const w = d.seoWeekly
  if (!w) return ''
  return `${w.periodLabel}: ${w.clicksLabel} clicks from Google and ${w.impressionsLabel} views over the last 28 days. ${
    w.up.length ? `${w.up.length} page(s) moved up` : 'No page moved up'
  }${w.down.length ? `, ${w.down.length} moved down` : ''}.`
}

const plain = (d: TemplateData): string => {
  const w = d.seoWeekly
  if (!w) return ''
  const list = (title: string, lines: string[]) => (lines.length ? ['', `${title}:`, ...lines] : [])
  return [
    w.sinceLastWeek ? seoWeeklyWords.vsLastWeek : seoWeeklyWords.vsBefore,
    ...list(
      seoWeeklyWords.movedUp,
      w.up.map((m) => `- ${m.title}: ${seoWeeklyWords.move(m.from, m.to)}`),
    ),
    ...list(
      seoWeeklyWords.movedDown,
      w.down.map((m) => `- ${m.title}: ${seoWeeklyWords.move(m.from, m.to)}`),
    ),
    ...list(
      seoWeeklyWords.tryNext,
      w.suggestions.map((s) => `- ${s.title}: ${seoWeeklyWords.suggestion(s)} ${s.url}`),
    ),
  ].join('\n')
}

export const seoTemplates = {
  staff_seo_weekly: {
    subject: (d) => `${d.storeName}: your week on Google`,
    heading: (d) => `Your week on Google, ${d.storeName}`,
    intro: lead,
    outro: plain,
    whatsapp: (d) => `${d.storeName} weekly SEO. ${lead(d)}`,
  },
} satisfies Record<'staff_seo_weekly', TemplateCopy>
