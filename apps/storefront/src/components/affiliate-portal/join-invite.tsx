'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { FieldError } from '@commerce/ui/shadcn/field'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { affiliateContent } from '@/data/affiliate'
import { joinFromOrderAction } from '@/lib/affiliate-actions'
import CopyField from './copy-field'

type JoinInviteProps = {
  /** The signed invite from the order. */
  token: string
  /** The store's own origin, for the referral link. */
  origin: string
  /** The portal's home, to see sales and add payout details. */
  dashboard: string
}

const copy = affiliateContent.join

/** Share and earn: the one tap that makes the buyer an affiliate, then their link and code. */
export default function JoinInvite({ token, origin, dashboard }: JoinInviteProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [joined, setJoined] = useState<{ code: string; couponCode: string | null } | null>(null)
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
      <div className="flex flex-col gap-4">
        <p className="text-sm" role="status">
          {copy.done}
        </p>
        <CopyField value={`${origin.replace(/\/+$/, '')}/?ref=${joined.code}`} label={copy.link} />
        {joined.couponCode ? (
          <CopyField value={joined.couponCode} label={affiliateContent.dashboard.share.code} />
        ) : null}
        <Button variant="outline" nativeButton={false} render={<Link href={dashboard} />}>
          {copy.dashboard}
        </Button>
      </div>
    )

  // Render logic
  return (
    <div className="flex flex-col gap-3">
      {error ? <FieldError>{error}</FieldError> : null}
      <Button size="lg" className="w-full" loading={pending} onClick={handleJoin}>
        {pending ? copy.joining : copy.button}
      </Button>
    </div>
  )
}
