'use client'

import { CircleCheck } from '@commerce/ui/icons'
import { useState } from 'react'
import { PLANS, pricingContent } from '@/data/pricing'
import { recommendedPlan } from '@/lib/pricing-math'
import PageContainer from '../common/page-container'
import BillingToggle, { type Billing } from './billing-toggle'
import OrdersCalculator from './orders-calculator'
import PlanCard from './plan-card'
import SavingsCard from './savings-card'

const copy = pricingContent.page

const INITIAL_ORDERS = 1000
const INITIAL_AOV = 1200

/** The interactive part of the pricing page: billing toggle, order slider, savings and the plan cards. */
export default function PricingExplorer() {
  // Hooks
  const [billing, setBilling] = useState<Billing>('monthly')
  const [orders, setOrders] = useState(INITIAL_ORDERS)
  const [aov, setAov] = useState(INITIAL_AOV)

  // Render logic
  const recommended = recommendedPlan(orders)

  return (
    <>
      <PageContainer className="flex flex-col items-center gap-8">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <BillingToggle value={billing} onChange={setBilling} />
          <p className="glass-popover inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm text-foreground">
            <CircleCheck aria-hidden className="size-4" />
            {copy.feePill}
          </p>
        </div>
        <div className="grid w-full gap-6 lg:grid-cols-2">
          <OrdersCalculator
            orders={orders}
            onOrdersChange={setOrders}
            aov={aov}
            onAovChange={setAov}
          />
          <SavingsCard orders={orders} aov={aov} />
        </div>
      </PageContainer>
      <PageContainer className="mt-12 md:mt-16">
        <div className="grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan, index) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              step={index}
              upTo
              badge={
                plan.key === recommended.key
                  ? pricingContent.recommended
                  : plan.popular
                    ? pricingContent.mostPopular
                    : undefined
              }
            />
          ))}
        </div>
      </PageContainer>
    </>
  )
}
