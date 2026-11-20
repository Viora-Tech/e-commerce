import type { EmailBlock } from '../../emails/blocks'
import type { TemplateData, TemplateId } from '../../types'
import { orderPlaced } from './order-placed'

/** A message built from shared blocks: its kicker and its blocks in order. */
export type Composed = { eyebrow: string; blocks: EmailBlock[] }

type Composer = (d: TemplateData, action?: { label: string; url: string }) => Composed

/**
 * The messages already moved to the shared blocks (Figma batches, one batch at a time). A message
 * not listed here still renders through the older fields of `TransactionalEmail`.
 */
const COMPOSERS: Partial<Record<TemplateId, Composer>> = {
  order_placed: orderPlaced,
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
