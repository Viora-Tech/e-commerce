import type { TemplateData } from '../types'
import type { TemplateCopy } from './content-parts'
import { reportSubject } from './report-subject'

/**
 * The weekly and monthly team reports. The email itself is the `PerformanceReport` layout
 * (emails/performance-report.tsx); this copy is the subject and the plain-text part.
 */
const summary = (d: TemplateData): string => {
  const r = d.report
  if (!r) return ''
  const change = r.change ? ` (${r.change.label} ${r.changeNote})` : ''
  return `${r.periodLabel}: net sales ${r.netLabel}${change}.`
}

const plain = (d: TemplateData): string => {
  const r = d.report
  if (!r) return ''
  return [
    ...r.stats.map((s) => `${s.label}: ${s.value}${s.change ? ` (${s.change.label})` : ''}`),
    '',
    ...(r.sellers.length ? [`${r.sellersTitle}:`, ...r.sellers.map((s, i) => `${i + 1}. ${s.title}, ${s.soldLabel}, ${s.amountLabel}`)] : []),
    ...(r.todos.length ? ['', `${r.todoTitle}:`, ...r.todos.map((t) => `- ${t.text} ${t.url}`)] : []),
  ].join('\n')
}

export const reportTemplates = {
  staff_weekly_report: {
    subject: (d) => reportSubject(d, 'weekly report') ?? `${d.storeName} weekly report`,
    heading: (d) => d.report?.title ?? `Your week at ${d.storeName}.`,
    intro: summary,
    outro: plain,
    whatsapp: (d) => `${d.storeName} weekly report. ${summary(d)}`,
  },
  staff_monthly_report: {
    subject: (d) => reportSubject(d, 'monthly report') ?? `${d.storeName} monthly report`,
    heading: (d) => d.report?.title ?? `Your month at ${d.storeName}.`,
    intro: summary,
    outro: plain,
    whatsapp: (d) => `${d.storeName} monthly report. ${summary(d)}`,
  },
} satisfies Record<'staff_weekly_report' | 'staff_monthly_report', TemplateCopy>

/** The plain-text part of any report email, for clients that do not show HTML. */
export const reportPlainText = (d: TemplateData): string =>
  [d.report?.title ?? '', '', summary(d), '', plain(d), '', d.report?.button.url ?? ''].join('\n')
