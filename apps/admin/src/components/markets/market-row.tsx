'use client'

import type { MarketView } from '@commerce/core'
import { Earth, Eye, EyeOff, Pencil, Trash2 } from '@commerce/ui/icons'
import Link from 'next/link'
import ActionMenu from '@/components/layout/action-menu'
import StatusChip from '@/components/layout/status-chip'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import SettingsTableRow from '@/components/settings/settings-table-row'
import RowActionsCell from '@/components/table/row-actions-cell'
import { marketsContent } from '@/data/markets'
import { useCopy } from '@/hooks/use-copy'

type MarketRowProps = {
  market: MarketView
  /** The store's main domain, which subfolders hang off (`waimers.koomerce.app`). */
  primaryHost: string
  /** What this market changes from the store, e.g. "AED · +10% · waimers.in/ae"; '' for none. */
  customizations: string
  /** The market's own page. */
  href: string
  canManage: boolean
  switching: boolean
  onEdit: () => void
  onDelete: () => void
  onToggle: (enabled: boolean) => void
}

/** Countries shown by name before "and N more". */
const SHOWN_COUNTRIES = 3

/** One market, as Shopify's row: its name, status, the countries it includes and its customizations. */
export default function MarketRow({
  market: m,
  primaryHost,
  customizations,
  href,
  canManage,
  switching,
  onEdit,
  onDelete,
  onToggle,
}: MarketRowProps) {
  // Hooks
  const copy = useCopy(marketsContent)

  // Render logic
  const shown = m.countries.slice(0, SHOWN_COUNTRIES).join(', ')
  const more = m.countries.length - SHOWN_COUNTRIES
  const countries = more > 0 ? copy.moreCountries(shown, more) : shown
  const reach = m.isPrimary
    ? primaryHost
    : m.subfolder
      ? `${primaryHost}/${m.subfolder}`
      : (m.hostname ?? copy.choice)

  return (
    <SettingsTableRow>
      <SettingsTableCell>
        <div className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <Earth aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <Link
              href={href}
              className="truncate text-left font-semibold text-ink-strong hover:underline focus-visible:underline focus-visible:outline-none"
            >
              {m.name}
            </Link>
            {m.isPrimary ? <StatusChip>{copy.primary}</StatusChip> : null}
          </span>
          <span className="truncate pl-6 text-caption text-muted-foreground">{reach}</span>
        </div>
      </SettingsTableCell>
      <SettingsTableCell>
        <StatusChip tone={m.enabled ? 'success' : 'neutral'}>
          {m.enabled ? copy.hub.on : copy.hub.off}
        </StatusChip>
      </SettingsTableCell>
      <SettingsTableCell className="hidden text-muted-foreground sm:table-cell">
        {countries}
      </SettingsTableCell>
      <SettingsTableCell className="hidden text-muted-foreground md:table-cell">
        {customizations}
      </SettingsTableCell>
      {canManage ? (
        <SettingsTableCell className="w-16 p-0 last:pr-2 md:last:pr-2">
          <RowActionsCell>
            <ActionMenu
              label={copy.actions.label}
              items={[
                { label: copy.actions.edit, icon: Pencil, onSelect: onEdit },
                {
                  label: m.enabled ? copy.actions.turnOff : copy.actions.turnOn,
                  icon: m.enabled ? EyeOff : Eye,
                  hidden: m.isPrimary,
                  disabled: switching,
                  onSelect: () => onToggle(!m.enabled),
                },
                {
                  label: copy.actions.delete,
                  icon: Trash2,
                  destructive: true,
                  hidden: m.isPrimary,
                  onSelect: onDelete,
                },
              ]}
            />
          </RowActionsCell>
        </SettingsTableCell>
      ) : null}
    </SettingsTableRow>
  )
}
