'use client'

import { Truck } from '@commerce/ui/icons'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { appIcon } from '@/apps/app-icons'
import {
  isRunnable,
  ORDER_ACTION_PROCEDURES,
  type OrderActionButton,
} from '@/apps/order-action-procedures'
import {
  actionLabel,
  actionsFor,
  linkPath,
  type OrderAction,
  type OrderActionGroup,
  type OrderActionTarget,
  type OrderFacts,
  shipmentHref,
} from '@/apps/order-actions'
import type { ActionItem } from '@/components/layout/action-menu'
import { orderAppActionsContent } from '@/data/order-app-actions'
import { useCopy, useLocale } from '@/hooks/use-copy'

/** The bulk Create shipment dialog's orders, and the courier to start on (none: compare all). */
export type ShippingWith = { orderIds: string[]; providerId?: string | undefined }

/**
 * Installed apps' order actions as menu items, Shopify style: each app's name heads its
 * actions, each with the app's icon. Runs them too: a link opens its admin route, Create
 * shipment opens the order's Create shipment page (several orders: `shipping` opens the bulk
 * dialog), a procedure calls the API and toasts its answer (with its View, Download or Open
 * buttons), then `onDone` reloads.
 */
export function useOrderAppActions(groups: readonly OrderActionGroup[], onDone: () => void) {
  // Hooks
  const copy = useCopy(orderAppActionsContent)
  const locale = useLocale()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [shipping, setShipping] = useState<ShippingWith | null>(null)

  // Helpers
  const toastButton = (b: OrderActionButton) => ({
    label: b.label,
    onClick: () => {
      if (b.href) router.push(b.href)
      else
        b.run?.().catch((err: unknown) =>
          toast.error(err instanceof Error ? err.message : copy.failed),
        )
    },
  })

  const run = async (action: OrderAction, orderIds: string[]) => {
    const h = action.handler
    const [first] = orderIds
    if (!first) return
    if (h.type === 'link') {
      router.push(linkPath(h.path, orderIds))
      return
    }
    if (h.type === 'shipment') {
      if (orderIds.length === 1) router.push(shipmentHref(first, h.providerId))
      else setShipping({ orderIds, providerId: h.providerId })
      return
    }
    const call = ORDER_ACTION_PROCEDURES[h.procedure]
    if (!call) return
    setBusy(true)
    try {
      const result = await call(orderIds, copy)
      toast.success(result.message, {
        action: result.action ? toastButton(result.action) : undefined,
        cancel: result.secondary ? toastButton(result.secondary) : undefined,
        // Long enough to reach for View or Download.
        duration: result.action ? 10_000 : undefined,
      })
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  /**
   * Menu items for one menu: `order` filters by the actions' conditions (none on the bulk bar).
   * Each courier app's own "Create shipment" is folded into one (owner, 11 Nov): the order page
   * and the row menu already have it, and the bulk bar gets a single Create shipment that
   * compares every connected courier.
   */
  const items = (
    target: OrderActionTarget,
    order: OrderFacts | null,
    orderIds: string[],
  ): ActionItem[] => {
    const found = actionsFor(groups, target, order, (a) => isRunnable(a.handler))
    const anyShipment = found.some((g) => g.actions.some((a) => a.handler.type === 'shipment'))
    const appItems = found.flatMap((g) =>
      g.actions
        .filter((a) => a.handler.type !== 'shipment')
        .map((a, i) => ({
          id: `app:${g.appId}/${a.id}`,
          label: actionLabel(a, locale),
          icon: appIcon(g.icon),
          heading: i === 0 ? g.appName : undefined,
          disabled: busy,
          onSelect: () => void run(a, orderIds),
        })),
    )
    if (target !== 'bulk' || !anyShipment || orderIds.length === 0) return appItems
    return [
      {
        id: 'create-shipment',
        label: copy.createShipment,
        icon: Truck,
        disabled: busy,
        onSelect: () => setShipping({ orderIds }),
      },
      ...appItems,
    ]
  }

  return { items, busy, shipping, closeShipping: () => setShipping(null) }
}
