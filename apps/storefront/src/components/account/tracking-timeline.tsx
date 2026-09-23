import type { ShopperOrderDetail } from '@commerce/core'
import { accountContent, formatAccountDate, formatAccountDateTime } from '@/data/account'

type TrackingTimelineProps = {
  tracking: ShopperOrderDetail['tracking']
  timeZone: string
}

const copy = accountContent.order

/** The courier's scans, newest first, as a vertical timeline. */
export default function TrackingTimeline({ tracking, timeZone }: TrackingTimelineProps) {
  // Early returns
  if (!tracking) return <p className="text-body text-muted">{copy.noTracking}</p>

  // Render logic
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-small text-muted">{copy.waybill(tracking.waybill)}</span>
          {tracking.expectedDate ? (
            <span className="text-body font-medium">
              {copy.expected(formatAccountDate(tracking.expectedDate, timeZone))}
            </span>
          ) : null}
        </div>
        {tracking.trackingUrl ? (
          <a
            href={tracking.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--secondary btn--small"
          >
            {copy.trackOnSite}
          </a>
        ) : null}
      </div>
      {tracking.events.length === 0 ? (
        <p className="text-body text-muted">{copy.noEvents}</p>
      ) : (
        <ol className="flex flex-col">
          {tracking.events.map((e, i) => (
            <li
              key={`${e.at}-${e.status}-${e.description}`}
              className="relative flex gap-4 pb-5 last:pb-0"
            >
              <span className="relative flex w-3 shrink-0 justify-center">
                <span
                  className={`mt-1.5 size-2.5 rounded-full ${i === 0 ? 'bg-ink' : 'bg-line'}`}
                />
                {i < tracking.events.length - 1 ? (
                  <span className="absolute top-4 bottom-[-0.25rem] w-px bg-line" />
                ) : null}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className={`text-body ${i === 0 ? 'font-semibold' : ''}`}>
                  {e.description}
                </span>
                <span className="text-small text-muted">
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
