'use client'

import { MAX_PARCELS_LIMIT } from '@commerce/core/gst-registrations'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import SettingsCard from '@/components/settings/settings-card'
import { businessGstContent } from '@/data/business-gst'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type LocationsRoutingCardProps = {
  maxParcels: number
  canManage: boolean
}

const CHOICES = Array.from({ length: MAX_PARCELS_LIMIT }, (_, i) => i + 1)

/** How checkout sends orders: the routing rule in plain words, and the most parcels per order. */
export default function LocationsRoutingCard({ maxParcels, canManage }: LocationsRoutingCardProps) {
  // Hooks
  const {
    locations: { routing: copy },
  } = useCopy(businessGstContent)
  const router = useRouter()
  const [value, setValue] = useState(String(maxParcels))
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleChange = async (next: string) => {
    if (saving || next === value) return
    const previous = value
    setValue(next)
    setSaving(true)
    try {
      await api.businessGst.setMaxParcels({ maxParcels: Number(next) })
      toast.success(copy.saved)
      router.refresh()
    } catch (err) {
      setValue(previous)
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const options = CHOICES.map((n) => ({ value: String(n), label: copy.parcels(n) }))

  return (
    <SettingsCard title={copy.heading} description={copy.help}>
      {canManage ? (
        <div className="max-w-80">
          <ChoiceField
            id="max-parcels"
            label={copy.maxParcels}
            value={value}
            options={options}
            onChange={handleChange}
            help={copy.maxParcelsHelp}
          />
        </div>
      ) : (
        <p className="text-body">
          {copy.maxParcels}: {copy.parcels(maxParcels)}
        </p>
      )}
    </SettingsCard>
  )
}
