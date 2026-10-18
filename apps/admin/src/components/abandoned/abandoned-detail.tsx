'use client'

import { permissions } from '@commerce/core/permissions'
import { Copy, ShoppingCart } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import { abandonedDetailContent } from '@/data/abandoned-detail'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import AbandonedActivityCard from './abandoned-activity-card'
import AbandonedCartCard from './abandoned-cart-card'
import AbandonedCustomerCard from './abandoned-customer-card'
import type { AbandonedCheckout } from './abandoned-detail-types'
import AbandonedReminderCard from './abandoned-reminder-card'

type AbandonedDetailProps = {
  checkout: AbandonedCheckout
}

/** Short reference shown in the title, from the end of the cart id (the start is a timestamp): "#9C2F41". */
const refOf = (id: string) => `#${id.slice(-6).toUpperCase()}`

export default function AbandonedDetail({ checkout }: AbandonedDetailProps) {
  // Hooks
  const copy = useCopy(abandonedDetailContent)
  const fmt = useFormat()
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const [sending, setSending] = useState(false)

  // Event handlers
  const handleCopyLink = async () => {
    if (!checkout.recoveryUrl) return
    try {
      await navigator.clipboard.writeText(checkout.recoveryUrl)
      toast.success(copy.linkCopied)
    } catch {
      toast.error(copy.linkFailed)
    }
  }

  const handleSend = async () => {
    setSending(true)
    try {
      const r = await api.orders.sendRecovery({ cartId: checkout.id })
      toast.success(copy.toasts.sent(r.sent))
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.toasts.failed)
    } finally {
      setSending(false)
    }
  }

  // Render logic
  const who = checkout.customerName ?? checkout.email ?? checkout.phone ?? copy.anonymous
  const canSend =
    !checkout.recovered && Boolean(checkout.email) && hasPermission(permissions.ORDERS_WRITE)

  return (
    <ProoflyDetailPage
      header={
        <PageHeader
          title={copy.heading(refOf(checkout.id))}
          summary={copy.summary(
            who,
            fmt.ago(checkout.updatedAt),
            fmt.money(checkout.subtotalPaise),
          )}
          back={{ label: copy.back.label, href: routes.orders.abandonedCheckouts() }}
          lead={{ kind: 'icon', node: <ShoppingCart aria-hidden="true" /> }}
          size="sm"
          actions={
            <>
              {checkout.recoveryUrl ? (
                <Button variant="outline" onClick={handleCopyLink}>
                  <Copy />
                  {copy.copyLink}
                </Button>
              ) : null}
              {canSend ? (
                <Button loading={sending} onClick={handleSend}>
                  {checkout.recoverySentAt ? copy.sendAgain : copy.sendReminder}
                </Button>
              ) : null}
            </>
          }
        />
      }
      main={
        <>
          <AbandonedCartCard checkout={checkout} />
          <AbandonedActivityCard checkout={checkout} />
        </>
      }
      side={
        <>
          <AbandonedCustomerCard checkout={checkout} />
          <AbandonedReminderCard checkout={checkout} />
        </>
      }
    />
  )
}
