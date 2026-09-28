'use client'

import { EmiOffersBlock } from '@commerce/blocks'
import { emiOffersCopy } from '@commerce/plugin-emi/copy'
import { emiOfferFor } from '@commerce/plugin-emi/offer-for'
import { use } from 'react'
import { EmiOffersContext } from '@/lib/emi-offers-context'

type EmiOffersProps = {
  pricePaise: number
}

/**
 * The EMI & pay later app's line under the product price, for the selected
 * variant. Mounted by the product page only when the app is installed and
 * ready; draws nothing below the merchant's minimum price.
 */
export default function EmiOffers({ pricePaise }: EmiOffersProps) {
  // Hooks
  const config = use(EmiOffersContext)

  // Render logic
  const offer = emiOfferFor(config, pricePaise)

  return <EmiOffersBlock context={offer} copy={emiOffersCopy} />
}
