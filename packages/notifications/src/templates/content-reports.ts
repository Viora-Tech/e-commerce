import type { TemplateData } from '../types'
import type { TemplateCopy } from './content-parts'
import { reportSubject } from './report-subject'

/**
 * The weekly and monthly team reports. The email itself is the `PerformanceReport` layout
 * (emails/performance-report.tsx); this copy is the subject, the plain-text part and the few
 * fixed words the layout shows. Like every email word, English only.
 */
/** The words every report shows whatever its period; the rest comes in the report itself. */
export const reportWords = {
  netSales: 'Net sales',
  sources: 'Where your buyers came from',
  analytics: 'Analytics',
  settings: 'Notification settings',
  figuresNote: 'Figures count paid orders only. Turn it off in Account → Notifications.',
}

export type ReportWords = typeof reportWords

const summary = (d: TemplateData): string => {
  const r = d.report
  if (!r) return ''
  const change = r.change ? ` (${r.change.label} ${r.changeNote})` : ''
  return `${r.periodLabel}: ${reportWords.netSales.toLowerCase()} ${r.netLabel}${change}.`
}

const plain = (d: TemplateData): string => {
  const r = d.report
  if (!r) return ''
  return [
    ...r.stats.map((s) => `${s.label}: ${s.value}${s.change ? ` (${s.change.label})` : ''}`),
    '',
    ...(r.sellers.length
      ? [
          `${r.sellersTitle}:`,
          ...r.sellers.map((s, i) => `${i + 1}. ${s.title}, ${s.soldLabel}, ${s.amountLabel}`),
        ]
      : []),
    ...(r.sources.length
      ? ['', `${reportWords.sources}:`, ...r.sources.map((s) => `${s.label} ${s.percent}%`)]
      : []),
    ...(r.todos.length
      ? ['', `${r.todoTitle}:`, ...r.todos.map((t) => `- ${t.text} ${t.linkLabel}: ${t.url}`)]
      : []),
    '',
    `${r.moneyTitle}:`,
    ...r.money.map((m) => `${m.label}: ${m.amount}`),
    `${reportWords.netSales}: ${r.netLabel}`,
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
  [
    d.report?.title ?? '',
    '',
    summary(d),
    '',
    plain(d),
    '',
    d.report ? `${d.report.button.label}: ${d.report.button.url}` : '',
    '',
    d.report?.footer ?? '',
    reportWords.figuresNote,
    d.report?.settingsUrl ?? '',
  ].join('\n')
