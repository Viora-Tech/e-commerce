'use client'

import type { ConsentChannel } from '@commerce/core/privacy'
import { Columns } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { customersBulkEditContent } from '@/data/customers-bulk-edit'
import { useCopy } from '@/hooks/use-copy'
import { COLUMN_KEYS, CONSENT_KEYS, isConsentKey } from './customers-bulk-model'

type CustomersBulkColumnsMenuProps = {
  hidden: ReadonlySet<string>
  /** Channels the store can send on; the others are marked "not set up yet". */
  sendable: readonly ConsentChannel[]
  onToggle: (key: string, shown: boolean) => void
}

/** The "Columns" button (#1000): a checkbox per column, like the products sheet. */
export default function CustomersBulkColumnsMenu({
  hidden,
  sendable,
  onToggle,
}: CustomersBulkColumnsMenuProps) {
  // Hooks
  const copy = useCopy(customersBulkEditContent)

  // Helpers
  const nameOf = (key: string) => (copy.columns as Record<string, string>)[key] ?? key

  // Render logic
  const keys = COLUMN_KEYS.filter((k) => k !== 'email')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        <Columns className="size-4" />
        {copy.columnsMenu.label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70dvh] w-64 overflow-y-auto">
        {keys.map((key) => (
          <DropdownMenuCheckboxItem
            key={key}
            checked={!hidden.has(key)}
            onCheckedChange={(shown) => onToggle(key, shown)}
          >
            <span className="flex min-w-0 flex-col">
              {nameOf(key)}
              {isConsentKey(key) && !sendable.includes(CONSENT_KEYS[key]) ? (
                <span className="text-caption text-muted-foreground">
                  {copy.columnsMenu.notSendable}
                </span>
              ) : null}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
