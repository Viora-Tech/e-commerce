'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { paymentModesContent } from '@/data/payment-modes'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { type GatewayApp, isModeGateway } from './types'

/**
 * A gateway's Active/Inactive switch: turning it off waits for a confirm (`asking`), keys stay
 * saved either way. Shared by the card footer and the provider page's More actions.
 */
export function useGatewayActive(
  gateway: GatewayApp | undefined,
  onChanged: () => Promise<void> | void,
) {
  const { active: copy } = useCopy(paymentModesContent)
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)

  const setActive = async (active: boolean) => {
    if (!gateway || !isModeGateway(gateway.id)) return
    setBusy(true)
    try {
      const r = await api.payments.setActive({ providerId: gateway.id, active })
      if (!r.ok) {
        toast.error(r.message ?? copy.failed)
        return
      }
      toast.success(active ? copy.turnedOn : copy.turnedOff)
      await onChanged()
      // Redraws the layout's "Test mode" banner.
      router.refresh()
    } catch {
      toast.error(copy.failed)
    } finally {
      setBusy(false)
      setAsking(false)
    }
  }

  return {
    asking,
    setAsking,
    busy,
    /** Asks first, then turns it off. */
    deactivate: () => setAsking(true),
    activate: () => setActive(true),
    confirmOff: () => setActive(false),
  }
}
