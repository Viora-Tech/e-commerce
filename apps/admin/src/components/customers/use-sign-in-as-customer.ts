'use client'

import { permissions } from '@commerce/core/permissions'
import { ExternalLink } from '@commerce/ui/icons'
import { useState } from 'react'
import type { ActionItem } from '@/components/layout/action-menu'
import { customerSignInAsContent } from '@/data/customer-sign-in-as'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'

/**
 * "Sign in as customer" for the customer page's More actions: the menu item, hidden unless the
 * member may (`customers.sign_in_as`; the owner always may), and whether its confirm is open.
 * The server re-checks the permission on every call.
 */
export function useSignInAsCustomer() {
  // Hooks
  const copy = useCopy(customerSignInAsContent)
  const { hasPermission } = usePermissions()
  const [open, setOpen] = useState(false)

  // Render logic
  const items: ActionItem[] = [
    {
      id: 'customers:sign-in-as',
      label: copy.menu,
      icon: ExternalLink,
      hidden: !hasPermission(permissions.CUSTOMERS_SIGN_IN_AS),
      onSelect: () => setOpen(true),
    },
  ]

  return { items, open, setOpen }
}
