'use client'

import { permissions } from '@commerce/core/permissions'
import { REST_OF_WORLD } from '@commerce/core/shipping-rates'
import { Plus, Truck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import EmptyState from '@/components/layout/empty-state'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import SettingsTable from '@/components/settings/settings-table'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import SettingsTableRow from '@/components/settings/settings-table-row'
import RowActionsCell from '@/components/table/row-actions-cell'
import { stateName } from '@/data/india'
import { shippingRatesContent } from '@/data/shipping-rates'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { describePrice, fromRate, type LoadedZone } from './form-state'
import RowDeleteMenu from './row-delete-menu'

/** A country's name in the admin's language ("United Arab Emirates"). */
const regionName = (code: string, tag: string): string =>
  new Intl.DisplayNames([tag], { type: 'region' }).of(code) ?? code

type ShippingZonesCardProps = {
  /** The profile's zones, with their rates. */
  zones: LoadedZone[]
  profileId: string
  /** The General profile: an empty list there means delivery is free. */
  general: boolean
}

type ListCopy = (typeof shippingRatesContent)['list']

/** "Karnataka, Kerala · 2 PIN code rules", or "All of India". */
function coverage(copy: ListCopy, zone: LoadedZone, countryName: (code: string) => string) {
  const abroad = zone.countryCodes.filter((c) => c !== 'IN')
  if (abroad.length > 0) {
    const names = abroad.map((c) => (c === REST_OF_WORLD ? copy.restOfWorld : countryName(c)))
    const india = zone.countryCodes.includes('IN') ? [indiaCoverage(copy, zone)] : []
    return [...india, copy.countries(names)].join(' · ')
  }
  return indiaCoverage(copy, zone)
}

/** The India part of a zone: its states and PIN code rules. */
function indiaCoverage(copy: ListCopy, zone: LoadedZone): string {
  const includes = zone.pincodeRules.filter((r) => r.mode === 'include').length
  const excludes = zone.pincodeRules.length - includes
  if (zone.stateCodes.length === 0 && includes === 0) {
    return excludes ? copy.everywhereExcept(excludes) : copy.allIndia
  }
  const parts: string[] = []
  if (zone.stateCodes.length) parts.push(copy.states(zone.stateCodes.map(stateName)))
  if (zone.pincodeRules.length) parts.push(copy.pincodes(zone.pincodeRules.length))
  return parts.join(' · ')
}

const zoneHref = (id: string) => routes.settings.shippingZone(id)

/** A shipping profile's delivery areas: every zone with what it covers and charges. */
export default function ShippingZonesCard({ zones, profileId, general }: ShippingZonesCardProps) {
  // Hooks
  const ratesCopy = useCopy(shippingRatesContent)
  const fmt = useFormat()
  const { hasPermission } = usePermissions()
  const router = useRouter()

  // Handlers
  const handleDelete = async (id: string) => {
    await api.shipping.zones.delete({ id })
    toast.success(ratesCopy.zone.toasts.deleted)
    router.refresh()
  }

  // Render logic
  const copy = ratesCopy.list
  const canManage = hasPermission(permissions.SETTINGS_MANAGE)
  const create = canManage ? (
    <Button
      nativeButton={false}
      render={<Link href={routes.settings.newShippingZone(profileId)} />}
    >
      <Plus />
      {copy.create}
    </Button>
  ) : null

  // Early returns
  if (zones.length === 0) {
    return (
      <SettingsCard title={copy.heading} description={copy.meta}>
        <EmptyState
          icon={Truck}
          heading={general ? copy.empty.heading : ratesCopy.profile.zones.noAreasHeading}
          body={general ? copy.empty.body : ratesCopy.profile.zones.noAreasBody}
          action={create}
        />
      </SettingsCard>
    )
  }

  return (
    <SettingsTable
      heading={copy.heading}
      description={copy.meta}
      actions
      columns={[
        { label: copy.columns.zone },
        { label: copy.columns.covers, className: 'hidden md:table-cell' },
        { label: copy.columns.rates },
      ]}
      footer={create}
    >
      {zones.map((z) => (
        <SettingsTableRow key={z.id} href={zoneHref(z.id)} className="align-top">
          <SettingsTableCell>
            <Link
              href={zoneHref(z.id)}
              className="font-semibold text-ink-strong underline-offset-4 hover:underline"
            >
              {z.name}
            </Link>
            <div className="text-caption text-muted-foreground md:hidden">
              {coverage(copy, z, (c) => regionName(c, fmt.intl))}
            </div>
          </SettingsTableCell>
          <SettingsTableCell className="hidden text-muted-foreground md:table-cell">
            {coverage(copy, z, (c) => regionName(c, fmt.intl))}
          </SettingsTableCell>
          <SettingsTableCell className="whitespace-normal">
            {z.rates.length === 0 ? (
              <StatusChip tone="attention">{copy.noRates}</StatusChip>
            ) : (
              <ul className="flex flex-col gap-1">
                {z.rates.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold">{r.name}</span>
                    <span className="text-caption text-muted-foreground">
                      {describePrice(ratesCopy, fmt, fromRate(r))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SettingsTableCell>
          <SettingsTableCell className="w-16 p-0 last:pr-2 md:last:pr-2">
            <RowActionsCell href={zoneHref(z.id)}>
              {canManage ? (
                <RowDeleteMenu
                  name={z.name}
                  editHref={zoneHref(z.id)}
                  onDelete={() => handleDelete(z.id)}
                  confirm={ratesCopy.zone.delete}
                />
              ) : null}
            </RowActionsCell>
          </SettingsTableCell>
        </SettingsTableRow>
      ))}
    </SettingsTable>
  )
}
