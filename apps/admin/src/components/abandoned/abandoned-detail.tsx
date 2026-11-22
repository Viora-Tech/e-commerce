'use client'

import { permissions } from '@commerce/core/permissions'
import { Copy, ShoppingCart } from '@commerce/ui/icons'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import PageHeader from '@/components/layout/page-header'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import SaleSourceCard from '@/components/orders/sale-source-card'
import SendMessageDialog, { type CustomMessage } from '@/components/orders/send-message-dialog'
import { abandonedDetailContent } from '@/data/abandoned-detail'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
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
  const [reviewing, setReviewing] = useState(false)

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

  const handleSend = async (custom?: CustomMessage) => {
    setSending(true)
    try {
      const r = await api.orders.sendRecovery({ cartId: checkout.id, custom })
      toast.success(copy.toasts.sent(r.sent))
      router.refresh()
    } catch (err) {
      toast.error(errorText(err, copy.toasts.failed))
    } finally {
      setSending(false)
    }
  }

  // Render logic
  const ref = refOf(checkout.id)
  const who = checkout.customerName || checkout.email || checkout.phone
  const canSend =
    !checkout.recovered && Boolean(checkout.email) && hasPermission(permissions.ORDERS_WRITE)

  return (
    <ProoflyDetailPage
      header={
        <PageHeader
          title={who || copy.heading(ref)}
          summary={copy.summary(
            fmt.money(checkout.subtotalPaise),
            ref,
            fmt.ago(checkout.updatedAt),
          )}
          back={{ label: copy.back.label, href: routes.orders.abandonedCheckouts() }}
          lead={{ kind: 'icon', node: <ShoppingCart aria-hidden="true" /> }}
          size="sm"
          actions={
            checkout.recoveryUrl ? (
              <ActionMenu
                label={copy.moreActions}
                trigger="button"
                align="end"
                items={[{ label: copy.copyLink, icon: Copy, onSelect: handleCopyLink }]}
              />
            ) : null
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
          <AbandonedReminderCard
            checkout={checkout}
            canSend={canSend}
            sending={sending}
            onSend={() => setReviewing(true)}
            onCopyLink={handleCopyLink}
          />
          <AbandonedCustomerCard checkout={checkout} />
          {/* The touch the cart carries; the order placed from it copies the same one. */}
          <SaleSourceCard attribution={checkout.attribution} />
          <SendMessageDialog
            orderId={reviewing ? checkout.id : null}
            template="checkout_recovery"
            onSend={handleSend}
            onClose={() => setReviewing(false)}
          />
        </>
      }
    />
  )
}
