'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { routes } from '@/lib/routes'

/** `/apps/delhivery/pickups`: forwards to Orders → Shipments → Pickups, one place for every courier. */
export default function PickupsPage() {
  // Hooks
  const router = useRouter()
  useEffect(() => {
    router.replace(routes.orders.shipmentPickups())
  }, [router])

  return null
}
