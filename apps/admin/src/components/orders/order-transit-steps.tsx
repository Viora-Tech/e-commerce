import type { Tracking } from '@commerce/core'
import { CheckIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { orderNextStepContent } from '@/data/order-next-step'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { OrderShipment } from './order-detail-types'

type OrderTransitStepsProps = {
  shipment: NonNullable<OrderShipment>
}

const STEPS = ['picked_up', 'in_transit', 'out_for_delivery', 'delivered'] as const

const SHORT_DATE = { day: 'numeric', month: 'short' } as const

/** Where the parcel is on the courier's four steps: done, current, still to come. */
export default function OrderTransitSteps({ shipment }: OrderTransitStepsProps) {
  // Hooks
  const copy = useCopy(orderNextStepContent)
  const fmt = useFormat()

  // Render logic
  const tracking = (shipment.tracking ?? null) as Tracking | null
  const status = tracking?.status ?? shipment.status
  const current = Math.max((STEPS as readonly string[]).indexOf(status), 0)
  const last = tracking?.events.at(-1)

  return (
    <ol className="grid grid-cols-4 gap-2">
      {STEPS.map((step, i) => {
        const done = i < current
        const here = i === current
        const event = tracking?.events.find((e) => e.status === step)
        const note = here
          ? [copy.transit.now, last?.location].filter(Boolean).join(' · ')
          : done && event
            ? fmt.when(event.at)
            : step === 'delivered' && tracking?.expectedDate
              ? copy.transit.expectedStep(fmt.pattern(tracking.expectedDate, SHORT_DATE))
              : ''
        return (
          <li key={step} className="flex flex-col gap-1.5">
            <div className="flex items-center">
              <span
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-full border-2',
                  done && 'border-primary bg-primary text-primary-foreground',
                  here && 'border-primary bg-card',
                  !done && !here && 'border-border-strong bg-card',
                )}
              >
                {done ? <CheckIcon className="size-2.5" strokeWidth={3} aria-hidden /> : null}
                {here ? <span className="size-1.5 rounded-full bg-primary" /> : null}
              </span>
              {i < STEPS.length - 1 ? (
                <span
                  className={cn('h-0.5 flex-1', done ? 'bg-primary' : 'bg-border')}
                  aria-hidden
                />
              ) : null}
            </div>
            <div className="flex flex-col">
              <span
                className={cn(
                  'text-body',
                  here || done ? 'font-medium text-ink-strong' : 'text-foreground',
                )}
              >
                {copy.transit.steps[step]}
              </span>
              {note ? <span className="text-caption text-muted-foreground">{note}</span> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
