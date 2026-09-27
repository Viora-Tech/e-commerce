'use client'

import type { DataRequestKind, DataRequestStatus } from '@commerce/core/privacy'
import { useState, useTransition } from 'react'
import { formatAccountDate } from '@/data/account'
import { privacyContent } from '@/data/privacy'
import { requestDataCopyAction } from '@/lib/privacy-actions'

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
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3 rounded-2xl border border-line p-6">
        <h2 className="h3">{copy.copy.heading}</h2>
        <p className="text-body text-muted">{copy.copy.body}</p>
        <div>
          <button
            type="button"
            className={`btn btn--secondary${pending ? ' is-loading' : ''}`}
            disabled={pending || copyOpen}
            onClick={handleCopy}
          >
            <span className="btn__label">{copy.copy.button}</span>
          </button>
        </div>
        {message ? (
          <p className="text-small" role="status">
            {message}
          </p>
        ) : null}
      </section>
      {requests.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="h4">{copy.requests.heading}</h2>
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
            {requests.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-4"
              >
                <span className="flex flex-col">
                  <span className="text-body">{copy.requests.kinds[r.kind]}</span>
                  <span className="text-small text-muted">
                    {copy.requests.madeOn(formatAccountDate(r.createdAt, timeZone))}
                  </span>
                </span>
                <span className="text-small font-medium">{copy.requests.statuses[r.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
