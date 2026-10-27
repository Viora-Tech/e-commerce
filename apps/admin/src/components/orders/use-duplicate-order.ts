'use client'

import { permissions } from '@commerce/core/permissions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { orderDetailContent } from '@/data/order-detail'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

/**
 * "Duplicate order" (issue #674) for the order page and the list's row menu: a new draft
 * prefilled from the order, opened in the draft editor. Never places an order. `allowed` is
 * false for a member who cannot create drafts, so the item is hidden.
 */
export function useDuplicateOrder() {
  const router = useRouter()
  const copy = useCopy(orderDetailContent).duplicate
  const { hasPermission } = usePermissions()

  const duplicate = async (orderId: string) => {
    try {
      const draft = await api.orders.duplicateOrder({ id: orderId })
      toast.success(draft.skipped.length > 0 ? copy.skipped(draft.skipped.length) : copy.done)
      router.push(routes.orders.draft(draft.id))
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    }
  }

  return { allowed: hasPermission(permissions.DRAFTS_WRITE), label: copy.action, duplicate }
}
