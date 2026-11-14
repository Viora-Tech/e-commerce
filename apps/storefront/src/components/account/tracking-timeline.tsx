import type { ShopperOrderDetail } from '@commerce/core'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { accountContent, formatAccountDate, formatAccountDateTime } from '@/data/account'
import { CK_BUTTON_SECONDARY } from '@/lib/checkout-classes'

type TrackingTimelineProps = {
  tracking: ShopperOrderDetail['tracking']
  /** Says delivered or on its way, not "as soon as it ships", when there is no courier tracking. */
  fulfillmentStatus?: ShopperOrderDetail['fulfillmentStatus']
  timeZone: string
}

const copy = accountContent.order

const DELIVERED = new Set(['delivered', 'partially_delivered', 'returned'])

/**
 * The courier's scans, newest first, as a vertical timeline (Figma 705:114664): the tracking
 * number, the expected day in bold, then each scan on a rail, the newest in the accent.
 */
export default function TrackingTimeline({
  tracking,
  timeZone,
  fulfillmentStatus,
}: TrackingTimelineProps) {
  // Early returns
  if (!tracking) {
    const text =
      fulfillmentStatus && DELIVERED.has(fulfillmentStatus)
        ? copy.noTrackingDelivered
        : fulfillmentStatus && fulfillmentStatus !== 'unfulfilled'
          ? copy.noTrackingShipped
          : copy.noTracking
    return <p className="text-[0.9375rem] text-ck-muted">{text}</p>
  }

  // Render logic
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[0.8125rem] break-all text-ck-muted">
            {copy.waybill(tracking.waybill)}
          </span>
          {tracking.expectedDate ? (
            <span className="text-[1rem] font-semibold">
              {copy.expected(formatAccountDate(tracking.expectedDate, timeZone))}
            </span>
          ) : null}
        </div>
        {tracking.trackingUrl ? (
          <a
            href={tracking.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${CK_BUTTON_SECONDARY} text-[0.875rem]!`}
          >
            {copy.trackOnSite}
            <CheckoutIcon name="arrow" className="size-3.5 -rotate-45" />
          </a>
        ) : null}
      </div>
      {tracking.events.length === 0 ? (
        <p className="text-[0.9375rem] text-ck-muted">{copy.noEvents}</p>
      ) : (
        <ol className="flex flex-col">
          {tracking.events.map((e, i) => (
            <li
              key={`${e.at}-${e.status}-${e.description}`}
              className="relative flex gap-3.5 pb-5 last:pb-0"
            >
              <span className="relative flex w-3 shrink-0 justify-center">
                <span
                  className={`mt-1.5 size-2.5 rounded-full ${i === 0 ? 'bg-ck-accent-lift [box-shadow:0_0_0_4px_var(--ck-ring)]' : 'bg-ck-line-strong'}`}
                />
                {i < tracking.events.length - 1 ? (
                  <span className="absolute top-4 bottom-[-0.25rem] w-px bg-ck-line-strong" />
                ) : null}
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span
                  className={`text-[0.9375rem] ${i === 0 ? 'font-semibold text-ck-ink' : 'text-ck-ink'}`}
                >
                  {e.description}
                </span>
                <span className="text-[0.8125rem] text-ck-muted">
                  {formatAccountDateTime(e.at, timeZone)}
                  {e.location ? ` · ${e.location}` : ''}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
