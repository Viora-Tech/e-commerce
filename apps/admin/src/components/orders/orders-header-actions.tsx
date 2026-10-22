'use client'

import { SquarePlus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import Link from 'next/link'
import ActionMenu from '@/components/layout/action-menu'
import { ordersContent } from '@/data/orders'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type OrdersHeaderActionsProps = {
  /** Orders paid on a gateway's test keys; "Delete test orders" shows while there are some. */
  testOrders: number
  onDeleteTests: () => void
}

/** The orders list header: More actions (the other order lists) and the one key button. */
export default function OrdersHeaderActions({
  testOrders,
  onDeleteTests,
}: OrdersHeaderActionsProps) {
  // Hooks
  const copy = useCopy(ordersContent)

  return (
    <div className="flex items-center gap-2">
      <ActionMenu
        label={copy.moreActions}
        trigger="button"
        variant="key-neutral"
        items={[
          { label: copy.menu.drafts, href: routes.orders.drafts() },
          { label: copy.menu.abandoned, href: routes.orders.abandonedCheckouts() },
          { label: copy.menu.returns, href: routes.orders.returns() },
          ...(testOrders > 0
            ? [
                {
                  label: copy.deleteTests.menu,
                  icon: Trash2,
                  destructive: true,
                  onSelect: onDeleteTests,
                },
              ]
            : []),
        ]}
      />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button render={<Link href={routes.orders.drafts()} />} nativeButton={false}>
              <SquarePlus strokeWidth={1.6} />
              {copy.addOrder}
            </Button>
          }
        />
        <TooltipContent>
          {copy.addOrder} <Kbd>N</Kbd>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
