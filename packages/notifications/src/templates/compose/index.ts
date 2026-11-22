import type { EmailBlock } from '../../emails/blocks'
import type { TemplateData, TemplateId } from '../../types'
import { accountComposers } from './account'
import { chatComposers } from './chat'
import { codeComposers } from './codes'
import { deliveryComposers } from './delivery'
import { marketingComposers } from './marketing'
import { orderPlaced } from './order-placed'
import { paymentComposers } from './payments'
import { returnComposers } from './returns'
import { seoComposers } from './seo'
import { teamComposers } from './team'
import { updateComposers } from './updates'

/**
 * A message built from shared blocks: its kicker and its blocks in order. `heading` and `lead`
 * replace the copy's heading and intro in the HTML only (the plain text keeps the longer intro);
 * `ownsNote` when a block already shows the merchant's note, so it is not printed twice.
 */
export type Composed = {
  eyebrow: string
  heading?: string | undefined
  lead?: string | undefined
  ownsNote?: boolean | undefined
  blocks: EmailBlock[]
}

export type Composer = (d: TemplateData, action?: { label: string; url: string }) => Composed

/**
 * The messages already moved to the shared blocks (Figma batches, one batch at a time). A message
 * not listed here still renders through the older fields of `TransactionalEmail`.
 */
const COMPOSERS: Partial<Record<TemplateId, Composer>> = {
  order_placed: orderPlaced,
  ...codeComposers,
  ...deliveryComposers,
  ...updateComposers,
  ...paymentComposers,
  ...returnComposers,
  ...accountComposers,
  ...marketingComposers,
  ...teamComposers,
  ...seoComposers,
  ...chatComposers,
}

/** The kicker and blocks for a message, or null when it is not on the blocks yet. */
export function composeEmail(
  template: TemplateId,
  d: TemplateData,
  action?: { label: string; url: string },
): Composed | null {
  const compose = COMPOSERS[template]
  return compose ? compose(d, action) : null
}
