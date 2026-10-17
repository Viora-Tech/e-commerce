'use client'

import { Input } from '@commerce/ui/shadcn/input'
import { Slider } from '@commerce/ui/shadcn/slider'
import { pricingContent } from '@/data/pricing'
import {
  formatCount,
  ordersFromSlider,
  recommendedPlan,
  SLIDER_STEPS,
  sliderFromOrders,
} from '@/lib/pricing-math'

type OrdersCalculatorProps = {
  orders: number
  onOrdersChange: (orders: number) => void
  aov: number
  onAovChange: (aov: number) => void
}

const copy = pricingContent.page.calculator

export default function OrdersCalculator({
  orders,
  onOrdersChange,
  aov,
  onAovChange,
}: OrdersCalculatorProps) {
  // Render logic
  const plan = recommendedPlan(orders)

  return (
    <div className="surface-card flex flex-col gap-6 rounded-3xl p-6 md:p-8">
      <h2 className="text-base font-semibold text-foreground">{copy.title}</h2>
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <p id="orders-label" className="text-sm text-muted-foreground">
            {copy.orders}
          </p>
          <p className="text-3xl font-semibold text-foreground tabular-nums">
            {formatCount(orders)}
          </p>
        </div>
        <Slider
          aria-labelledby="orders-label"
          min={0}
          max={SLIDER_STEPS}
          step={1}
          value={sliderFromOrders(orders)}
          onValueChange={(next) => {
            const position = Array.isArray(next) ? (next[0] ?? 0) : next
            onOrdersChange(ordersFromSlider(position))
          }}
        />
        <div aria-hidden className="relative h-4 text-xs text-muted-foreground">
          {copy.ordersTicks.map((tick) => (
            <span
              key={tick.value}
              className={`absolute ${tick.at} -translate-x-1/2 first:translate-x-0 last:-translate-x-full`}
            >
              {formatCount(tick.value)}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="aov" className="text-sm text-muted-foreground">
          {copy.aov}
        </label>
        <div className="flex items-center gap-1">
          <span aria-hidden className="text-sm text-muted-foreground">
            ₹
          </span>
          <Input
            id="aov"
            type="number"
            inputMode="numeric"
            min={0}
            size="lg"
            className="w-28 text-right"
            value={aov}
            onChange={(event) => onAovChange(Math.max(0, Number(event.target.value) || 0))}
          />
        </div>
      </div>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {copy.recommended}
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
          {plan.name}
        </span>
      </p>
    </div>
  )
}
