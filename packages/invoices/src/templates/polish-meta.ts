import type { DocumentSnapshot } from '../snapshot'
import type { TemplateView } from './view'

/**
 * The meta rows of the Polish template's strip, kept apart from the JSX so the rule (number
 * dropped because the band shows it, "Order" split into order and order date) is testable.
 */

const DATE_LABELS: Partial<Record<DocumentSnapshot['kind'], string>> = {
  tax_invoice: 'Invoice date',
  credit_note: 'Credit note date',
}

/** The meta rows as the strip shows them: number dropped (it is in the band), order split. */
export function stripItems(doc: DocumentSnapshot, view: TemplateView) {
  const items: { label: string; value: string }[] = []
  for (const m of view.meta) {
    if (doc.number && m.value === doc.number) continue
    if (m.label === 'Date') {
      items.push({ label: DATE_LABELS[doc.kind] ?? 'Date', value: m.value })
    } else if (m.label === 'Order') {
      const [name, ...rest] = m.value.split(', ')
      items.push({ label: 'Order', value: name ?? m.value })
      if (rest.length) items.push({ label: 'Order date', value: rest.join(', ') })
    } else items.push(m)
  }
  return items
}
