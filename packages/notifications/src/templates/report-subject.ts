import type { TemplateData } from '../types'

/** "Waimers weekly report: ₹1,84,320 ▲ 18%", or null when the message carries no report. */
export function reportSubject(d: TemplateData, what: string): string | null {
  const r = d.report
  if (!r) return null
  return `${d.storeName} ${what}: ${r.netLabel}${r.change ? ` ${r.change.label}` : ''}`
}
