'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { affiliateContent } from '@/data/affiliate'
import { joinFromOrderAction } from '@/lib/affiliate-actions'
import CopyValue from './copy-value'

type AffiliateJoinProps = {
  /** The signed invite from the order. */
  token: string
  origin: string
}

type Joined = { code: string; couponCode: string | null }

const copy = affiliateContent.join

/** The one tap that makes the buyer an affiliate, then their link and code to share. */
export default function AffiliateJoin({ token, origin }: AffiliateJoinProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [joined, setJoined] = useState<Joined | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Event handlers
  const handleJoin = () => {
    setError(null)
    start(async () => {
      const r = await joinFromOrderAction(token)
      if (r.ok) setJoined({ code: r.code, couponCode: r.couponCode })
      else setError(copy.errors[r.error] ?? copy.errors.generic ?? '')
    })
  }

  // Early returns
  if (joined)
    return (
      <div className="flex max-w-[36rem] flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-6">
        <p className="text-body" role="status">
          {copy.done}
        </p>
        <CopyValue label={copy.link} value={`${origin.replace(/\/+$/, '')}/?ref=${joined.code}`} />
        {joined.couponCode ? (
          <CopyValue label={affiliateContent.dashboard.share.code} value={joined.couponCode} />
        ) : null}
        <Link href="/affiliate" className="text-body underline">
          {copy.dashboard}
        </Link>
      </div>
    )

  // Render logic
  return (
    <div className="flex flex-col items-start gap-3">
      {error ? (
        <p className="text-small text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={handleJoin}
        className={`btn btn--primary${pending ? ' is-loading' : ''}`}
        disabled={pending}
      >
        <span className="btn__label">{pending ? copy.joining : copy.button}</span>
      </button>
    </div>
  )
}
