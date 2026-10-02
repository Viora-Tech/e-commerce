'use client'

import type { Business, BusinessGstView } from '@commerce/core'
import { permissions } from '@commerce/core/permissions'
import { useState } from 'react'
import { usePermissions } from '@/hooks/use-permissions'
import AddRegistrationDialog from './add-registration-dialog'
import BusinessCard from './business-card'
import BusinessDialog from './business-dialog'
import OtherBusinesses from './other-businesses'
import RegistrationsCard from './registrations-card'

type BusinessGstSettingsProps = {
  view: BusinessGstView
}

/** Which business the business dialog edits; `null` business adds a new one. */
type BusinessDialogState = { business: Business | null } | null

/**
 * The GST numbers tab of Settings › Taxes & GST (once its own page, "Business and GST"): the
 * main business (PAN), its GST numbers with the default one, and other businesses behind an
 * Advanced disclosure. Every change refreshes the server page.
 */
export default function BusinessGstSettings({ view }: BusinessGstSettingsProps) {
  // Hooks
  const { hasPermission } = usePermissions()
  const [addOpen, setAddOpen] = useState(false)
  const [businessDialog, setBusinessDialog] = useState<BusinessDialogState>(null)

  // Event handlers
  const handleAnotherBusiness = () => {
    setAddOpen(false)
    setBusinessDialog({ business: null })
  }

  // Render logic
  const canManage = hasPermission(permissions.SETTINGS_MANAGE)
  const main = view.businesses.find((b) => b.isPrimary) ?? null
  const others = view.businesses.filter((b) => !b.isPrimary)
  const editing = businessDialog?.business ?? null
  const panLocked = editing ? view.registrations.some((r) => r.businessId === editing.id) : false

  return (
    <div className="flex flex-col gap-4">
      <BusinessCard
        business={main}
        canManage={canManage}
        onEdit={(business) => setBusinessDialog({ business })}
      />
      <RegistrationsCard
        registrations={view.registrations}
        businesses={view.businesses}
        canManage={canManage}
        onAdd={() => setAddOpen(true)}
      />
      <OtherBusinesses
        businesses={others}
        canManage={canManage}
        onAdd={() => setBusinessDialog({ business: null })}
        onEdit={(business) => setBusinessDialog({ business })}
      />
      <AddRegistrationDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        businesses={view.businesses}
        onAnotherBusiness={handleAnotherBusiness}
      />
      <BusinessDialog
        open={businessDialog !== null}
        onOpenChange={(open) => (open ? undefined : setBusinessDialog(null))}
        business={editing}
        panLocked={panLocked}
      />
    </div>
  )
}
