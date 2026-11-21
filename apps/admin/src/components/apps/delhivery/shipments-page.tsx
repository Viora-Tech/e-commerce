'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { routes } from '@/lib/routes'

/**
 * `/apps/delhivery/shipments`: forwards to Orders → Shipments filtered to Delhivery. The app kept
 * its own copy of the list, whose counts disagreed with the workspace (owner, 18 Nov 2026).
 */
export default function ShipmentsPage() {
  // Hooks
  const router = useRouter()
  useEffect(() => {
    router.replace(routes.orders.courierShipments('delhivery'))
  }, [router])

  return null
}
