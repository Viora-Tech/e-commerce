'use client'

import { permissions } from '@commerce/core/permissions'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import SettingsTable from '@/components/settings/settings-table'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import SettingsTableRow from '@/components/settings/settings-table-row'
import RowActionsCell from '@/components/table/row-actions-cell'
import { shippingRatesContent } from '@/data/shipping-rates'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { describePrice, fromRate } from './form-state'
import RowDeleteMenu from './row-delete-menu'

type LoadedProfile = Awaited<ReturnType<typeof api.shipping.profiles.list>>[number]

const profileHref = (id: string) => routes.settings.shippingProfile(id)

/** Rate names and prices of every zone, deduplicated: "Delhivery ₹99 · Bluedart ₹139". */
const rateLines = (p: LoadedProfile) =>
  p.zones
    .flatMap((z) => z.rates)
    .filter((r, i, all) => all.findIndex((x) => x.name === r.name) === i)

/**
 * Settings → Shipping: the store's shipping profiles, General first, with how many products
 * each holds and the prices it charges. Each row opens the profile's page; its ⋯ menu edits or
 * deletes it (not General).
 */
export default function ShippingProfilesCard() {
  // Hooks
  const ratesCopy = useCopy(shippingRatesContent)
  const fmt = useFormat()
  const { hasPermission } = usePermissions()
  const [profiles, setProfiles] = useState<LoadedProfile[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    api.shipping.profiles
      .list()
      .then((p) => {
        if (live) setProfiles(p)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [])

  // Handlers
  const handleDelete = async (id: string) => {
    await api.shipping.profiles.delete({ id })
    setProfiles((all) => (all ?? []).filter((p) => p.id !== id))
    toast.success(ratesCopy.profile.toasts.deleted)
  }

  // Render logic
  const copy = ratesCopy.profiles
  const canManage = hasPermission(permissions.SETTINGS_MANAGE)
  const anyZones = (profiles ?? []).some((p) => p.zones.length > 0)
  const create = canManage ? (
    <Button
      variant="outline"
      nativeButton={false}
      render={<Link href={routes.settings.newShippingProfile()} />}
    >
      <Plus />
      {copy.create}
    </Button>
  ) : null

  // Early returns
  if (failed || profiles === null) {
    return (
      <SettingsCard title={copy.heading} description={copy.meta}>
        {failed ? (
          <p className="text-body text-danger">{copy.loadFailed}</p>
        ) : (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}
      </SettingsCard>
    )
  }

  return (
    <SettingsTable
      heading={copy.heading}
      description={copy.meta}
      actions
      columns={[
        { label: copy.columns.profile },
        { label: copy.columns.products, className: 'hidden md:table-cell' },
        { label: copy.columns.areas },
      ]}
      footer={create}
    >
      {profiles.map((p) => {
        const products =
          p.productCount === null ? copy.allOtherProducts : copy.productCount(p.productCount)
        return (
          <SettingsTableRow key={p.id} href={profileHref(p.id)} className="align-top">
            <SettingsTableCell>
              <Link
                href={profileHref(p.id)}
                className="font-semibold text-ink-strong underline-offset-4 hover:underline"
              >
                {p.name}
              </Link>
              <div className="text-caption text-muted-foreground md:hidden">{products}</div>
            </SettingsTableCell>
            <SettingsTableCell className="hidden whitespace-normal text-muted-foreground md:table-cell">
              {products}
            </SettingsTableCell>
            <SettingsTableCell className="whitespace-normal">
              {p.zones.length === 0 ? (
                anyZones ? (
                  <StatusChip tone="attention">{copy.noAreas}</StatusChip>
                ) : (
                  <span className="text-muted-foreground">{copy.freeEverywhere}</span>
                )
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="text-caption text-muted-foreground">
                    {copy.areaCount(p.zones.length)}
                  </span>
                  <ul className="flex flex-col gap-1">
                    {rateLines(p).map((r) => (
                      <li key={r.id} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-semibold">{r.name}</span>
                        <span className="text-caption text-muted-foreground">
                          {describePrice(ratesCopy, fmt, fromRate(r))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </SettingsTableCell>
            <SettingsTableCell className="w-16 p-0 last:pr-2 md:last:pr-2">
              <RowActionsCell href={profileHref(p.id)}>
                {canManage ? (
                  <RowDeleteMenu
                    name={p.name}
                    editHref={profileHref(p.id)}
                    // General holds every product not placed elsewhere: it cannot go.
                    onDelete={p.productCount === null ? undefined : () => handleDelete(p.id)}
                    confirm={ratesCopy.profile.delete}
                  />
                ) : null}
              </RowActionsCell>
            </SettingsTableCell>
          </SettingsTableRow>
        )
      })}
    </SettingsTable>
  )
}
