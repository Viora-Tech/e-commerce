import { EmiOffersBlock, type EmiOffersContext } from '@commerce/blocks'
import type { AppBlockDefinition } from '@commerce/plugins'
import { emiOffersCopy as copy } from './copy'
import { EMI_PAY_LATER_ID } from './offer'

function render(props: { puck?: { metadata?: Record<string, unknown> } }) {
  const context = (
    props.puck?.metadata?.appBlockContext as { emiOffers?: EmiOffersContext | null } | undefined
  )?.emiOffers
  return <EmiOffersBlock context={context} copy={copy} />
}

/**
 * The EMI & pay later app's storefront block, for a merchant who wants the
 * offer somewhere other than under the price (the app already puts it there).
 * The product page route works the offer out for the product's first
 * purchasable variant and hands it over as `appBlockContext.emiOffers`; the
 * copy under the price follows variant switching, this one stays on that
 * first variant. No DB or Next.js import, so the admin editor's client bundle
 * can import it too.
 */
export const emiBlocks: AppBlockDefinition[] = [
  {
    type: `${EMI_PAY_LATER_ID}/EmiOffers`,
    label: 'EMI offers',
    description: 'Shows "or ₹X/month" with EMI or pay later for the product.',
    icon: 'CreditCard',
    fields: {},
    defaultProps: {},
    render: render as unknown as AppBlockDefinition['render'],
  },
]
