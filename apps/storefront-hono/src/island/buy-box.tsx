import { MoneyFormatProvider, ProductView, ReviewsCarousel, ReviewsWidget } from '@commerce/blocks'
import DeliveryEstimateWidget from '@/components/product/delivery-estimate'
import EmiHint from '@/components/product/emi-hint'
import EmiOffers from '@/components/product/emi-offers'
import EmiOffersProvider from '@/components/product/emi-offers-provider'
import NotifyMeForm from '@/components/product/notify-me-form'
import RecordView from '@/components/product/record-view'
import LiquidAppBlock from '@/components/theme/liquid-app-block'
import { importedReviewsContent as reviewsCopy } from '@/data/imported-reviews'
import { addLineAction } from '@/lib/cart-actions'
import type { IslandProps } from './props'

type BuyBoxProps = {
  island: IslandProps
}

const UNDER_PRICE = { 'emi-offers': EmiOffers, 'emi-hint': EmiHint } as const

/**
 * The product page's gallery and buy box as the Next product route draws its `MainProduct`
 * section (`app/-s/[storeId]/products/[handle]/page.tsx`), inside the price format the store
 * layout provides, plus the Reviews app's widgets the Next page portals into the theme's app block
 * slots (`LiquidAppBlock`, which draws nothing until it finds its slot after mounting, so it
 * hydrates against nothing exactly as on Next).
 *
 * The same tree is rendered to HTML on the Hono server and hydrated in the browser
 * (`./client.ts`), so both see the same props. `addLineAction` and the actions the widgets import
 * are the real server actions on the server (never called while rendering) and
 * `/theme-actions/island-*` calls in the browser bundle (`../../scripts/build-island.ts`).
 */
export default function BuyBox({ island }: BuyBoxProps) {
  // Render logic
  const view = (
    <ProductView
      product={island.product}
      onAddToCart={addLineAction}
      settings={island.settings}
      upiDiscount={island.upiDiscount}
      policyPanels={island.policyPanels}
      UnderPrice={island.underPrice ? UNDER_PRICE[island.underPrice] : undefined}
      belowBuy={<DeliveryEstimateWidget />}
      NotifyMe={island.notifyMe ? NotifyMeForm : undefined}
      notifyMeProps={island.notifyMe ?? undefined}
    />
  )

  return (
    <>
      <MoneyFormatProvider format={island.moneyFormat} pricing={island.pricing}>
        {island.emiConfig ? (
          <EmiOffersProvider config={island.emiConfig}>{view}</EmiOffersProvider>
        ) : (
          view
        )}
        <RecordView handle={island.product.handle} />
        {island.reviews ? (
          <LiquidAppBlock slot="reviews">
            <ReviewsWidget context={island.reviews} />
          </LiquidAppBlock>
        ) : null}
      </MoneyFormatProvider>
      {island.reviewsCarousel?.reviews.length ? (
        <LiquidAppBlock slot="reviews-carousel">
          <ReviewsCarousel
            kicker=""
            heading={reviewsCopy.heading}
            data={island.reviewsCarousel}
            showSummary
            showProduct
            showPhotos
            showDate={false}
            cardStyle="card"
            autoplay
            speed={5}
          />
        </LiquidAppBlock>
      ) : null}
    </>
  )
}
