'use client'

import { formatPercent } from '@commerce/money'
import { Eye } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import { CHIP_DOT } from '@/components/status/tone'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import PreviewCheckoutDialog from './preview-checkout-dialog'

type Status = Awaited<ReturnType<typeof api.deliveryOptions.status>>

/** Below this share of checkouts priced live, the pill's dot turns amber. */
const HEALTHY = 0.9

/**
 * The Delivery options app bar's right side (Figma 929:11373): the status pill (courier apps,
 * share of today's checkouts priced live; it needs Redis, which the shell's app bar read cannot
 * reach) and the "Preview checkout" action.
 */
export default function DeliveryOptionsHeaderAction() {
  // Hooks
  const pages = useCopy(deliveryPagesContent)
  const fmt = useFormat()
  const [status, setStatus] = useState<Status | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    api.deliveryOptions
      .status()
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [])

  // Render logic
  const h = pages.header
  const share = status?.checkouts24h
    ? (status.checkouts24h - status.backup24h) / status.checkouts24h
    : null
  const label = status
    ? share === null
      ? h.pillQuiet(status.apps)
      : h.pill(status.apps, formatPercent(share, { locale: fmt.intl, maximumFractionDigits: 0 }))
    : null
  const tone = share === null ? 'neutral' : share >= HEALTHY ? 'success' : 'attention'

  return (
    <>
      {label ? (
        <span
          title={label}
          className="hidden h-7.5 max-w-[22rem] min-w-0 items-center gap-1.5 rounded-full border border-hairline px-2.5 text-caption text-muted-foreground md:flex"
        >
          <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', CHIP_DOT[tone])} />
          <span className="truncate">{label}</span>
        </span>
      ) : null}
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Eye aria-hidden />
        {h.preview}
      </Button>
      {open ? <PreviewCheckoutDialog open onOpenChange={setOpen} /> : null}
    </>
  )
}
