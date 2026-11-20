'use client'

import type { DataRequestKind, DataRequestStatus } from '@commerce/core/privacy'
import { useState, useTransition } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { formatAccountDate } from '@/data/account'
import { privacyContent } from '@/data/privacy'
import {
  ACCOUNT_CARD,
  ACCOUNT_CARD_TITLE,
  ACCOUNT_INTRO,
  ACCOUNT_ROW,
  ACCOUNT_ROWS,
} from '@/lib/account-classes'
import { CK_BUTTON_SECONDARY } from '@/lib/checkout-classes'
import { requestDataCopyAction } from '@/lib/privacy-actions'
import StatusPill from './status-pill'

type DataRequestsProps = {
  requests: {
    id: string
    number: number
    kind: DataRequestKind
    status: DataRequestStatus
    createdAt: Date
  }[]
  timeZone: string
}

const copy = privacyContent

/** Done is good news, declined is not; anything still open is neutral. */
export const requestTone = (s: DataRequestStatus): 'good' | 'neutral' | 'bad' =>
  s === 'completed' ? 'good' : s === 'rejected' ? 'bad' : 'neutral'

/** "Get a copy of your data", and the shopper's own requests with where each stands. */
export default function DataRequests({ requests, timeZone }: DataRequestsProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  // Event handlers
  const handleCopy = () => {
    setMessage(null)
    start(async () => {
      const r = await requestDataCopyAction().catch(() => ({ ok: false }))
      setMessage(r.ok ? copy.copy.sent : copy.copy.failed)
    })
  }

  // Render logic
  const copyOpen = requests.some(
    (r) => r.kind === 'export' && (r.status === 'open' || r.status === 'in_progress'),
  )

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <section className={`${ACCOUNT_CARD} gap-3!`} aria-labelledby="data-copy">
        <h2 id="data-copy" className={ACCOUNT_CARD_TITLE}>
          {copy.copy.heading}
        </h2>
        <p className={ACCOUNT_INTRO}>{copy.copy.body}</p>
        <div>
          <button
            type="button"
            className={`${CK_BUTTON_SECONDARY} w-full sm:w-auto`}
            disabled={pending || copyOpen}
            onClick={handleCopy}
            aria-busy={pending || undefined}
          >
            <CheckoutIcon
              name={pending ? 'spinner' : 'download'}
              className={`size-4 ${pending ? 'animate-spin motion-reduce:animate-none' : ''}`}
            />
            {copy.copy.button}
          </button>
        </div>
        {message ? (
          <p className="text-[0.8125rem] text-ck-ink" role="status">
            {message}
          </p>
        ) : null}
      </section>
      {requests.length > 0 ? (
        <section className={`${ACCOUNT_CARD} gap-1!`} aria-labelledby="data-requests">
          <h2 id="data-requests" className={ACCOUNT_CARD_TITLE}>
            {copy.requests.heading}
          </h2>
          <ul className={ACCOUNT_ROWS}>
            {requests.map((r) => (
              <li key={r.id} className={`${ACCOUNT_ROW} flex-wrap`}>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[0.9375rem] text-ck-ink">
                    {copy.requests.kinds[r.kind]}
                  </span>
                  <span className="text-[0.8125rem] text-ck-muted">
                    {copy.requests.madeOn(formatAccountDate(r.createdAt, timeZone))}
                  </span>
                </span>
                <StatusPill label={copy.requests.statuses[r.status]} tone={requestTone(r.status)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
