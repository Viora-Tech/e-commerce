'use client'

import type { Business, GstRegistrationView } from '@commerce/core'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { businessGstContent } from '@/data/business-gst'
import { useCopy } from '@/hooks/use-copy'
import RegistrationRow from './registration-row'

type RegistrationsCardProps = {
  registrations: GstRegistrationView[]
  businesses: Business[]
  canManage: boolean
  onAdd: () => void
}

/** "GST numbers": one row per GSTIN, the default first, cancelled ones last. */
export default function RegistrationsCard({
  registrations,
  businesses,
  canManage,
  onAdd,
}: RegistrationsCardProps) {
  // Hooks
  const { registrations: copy } = useCopy(businessGstContent)

  // Helpers
  const nameOf = (id: string) => businesses.find((b) => b.id === id)?.legalName ?? ''

  // Render logic
  const showOwner = businesses.length > 1

  return (
    <Card size="form">
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle>{copy.heading}</CardTitle>
          <CardDescription>{copy.help}</CardDescription>
        </div>
        {canManage ? (
          <Button size="sm" onClick={onAdd}>
            <Plus aria-hidden="true" />
            {copy.add}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {registrations.length === 0 ? (
          <p className="text-body text-muted-foreground">{copy.empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {registrations.map((r) => (
              <RegistrationRow
                key={r.id}
                registration={r}
                owner={showOwner ? nameOf(r.businessId) : null}
                canManage={canManage}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
