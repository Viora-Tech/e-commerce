import type { TemplateData } from '../types'
import type { TemplateCopy } from './content-parts'

/** How many parcels the order now ships in (2 when the email has no parcel list). */
const partsOf = (d: TemplateData): number => Math.max(2, d.parcels?.length ?? 0)

/** Staff ship the ready items now and the rest later, and chose to tell the shopper. */
export const splitTemplates = {
  order_split: {
    subject: (d) => `${d.storeName}: order #${d.orderNumber} ships in ${partsOf(d)} parts`,
    heading: (d) => `Hi ${d.customerName}, your order ships in ${partsOf(d)} parts`,
    intro: (d) =>
      `Some items in order #${d.orderNumber} are ready now, so we are sending them first. The rest follow in their own parcel as soon as they are ready. You pay nothing extra.`,
    outro: () => 'We email you again when each parcel is on its way.',
    whatsapp: (d) =>
      `${d.storeName}: order #${d.orderNumber} ships in ${partsOf(d)} parts. The ready items go first; the rest follow when they are ready, at no extra cost.`,
  },
} satisfies Record<'order_split', TemplateCopy>
