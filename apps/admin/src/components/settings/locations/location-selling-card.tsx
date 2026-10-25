'use client'

import type { LocationBillingView } from '@commerce/core'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ToggleRow from '@/components/apps/gst-invoices/toggle-row'
import SettingsCard from '@/components/settings/settings-card'
import { businessGstContent } from '@/data/business-gst'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type LocationSellingCardProps = {
  location: LocationBillingView
  canManage: boolean
}

/** Whether checkout may send online orders from this location (the default always does). */
export default function LocationSellingCard({ location, canManage }: LocationSellingCardProps) {
  // Hooks
  const {
    location: { selling: copy },
  } = useCopy(businessGstContent)
  const router = useRouter()
  const [on, setOn] = useState(location.fulfilsOnlineOrders)
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleChange = async (next: boolean) => {
    if (saving) return
    setOn(next)
    setSaving(true)
    try {
      await api.businessGst.setLocationSelling({ locationId: location.id, sells: next })
      toast.success(copy.saved)
      router.refresh()
    } catch (err) {
      setOn(!next)
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const locked = location.isDefault || !canManage

  return (
    <SettingsCard title={copy.heading} description={copy.help} bodyClassName="flex flex-col gap-2">
      {locked ? (
        <p className="text-body text-foreground">
          {location.isDefault ? copy.defaultNote : on ? copy.on : copy.off}
        </p>
      ) : (
        <>
          <ToggleRow id="location-sells" label={copy.toggle} checked={on} onChange={handleChange} />
          <p className="text-caption text-muted-foreground">{on ? copy.on : copy.off}</p>
        </>
      )}
    </SettingsCard>
  )
}
