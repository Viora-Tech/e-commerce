'use client'

import { Pencil, Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import { shippingRatesContent } from '@/data/shipping-rates'
import { describeCondition, describeDelivery, describePrice, type RateDraft } from './form-state'
import RateDialog from './rate-dialog'

type ZoneRatesCardProps = {
  value: RateDraft[]
  onChange: (next: RateDraft[]) => void
  disabled?: boolean
}

const copy = shippingRatesContent.zone.rates

/** The rates of a zone: a table, with the add and edit dialog. */
export default function ZoneRatesCard({ value, onChange, disabled }: ZoneRatesCardProps) {
  // Hooks
  const [editing, setEditing] = useState<RateDraft | null>(null)
  const [open, setOpen] = useState(false)

  // Event handlers
  const handleAdd = () => {
    setEditing(null)
    setOpen(true)
  }

  const handleEdit = (rate: RateDraft) => {
    setEditing(rate)
    setOpen(true)
  }

  const handleDone = (rate: RateDraft) => {
    const exists = value.some((r) => r.key === rate.key)
    onChange(exists ? value.map((r) => (r.key === rate.key ? rate : r)) : [...value, rate])
  }

  const handleRemove = (key: string) => {
    onChange(value.filter((r) => r.key !== key))
  }

  return (
    <DataCard
      title={copy.heading}
      meta={copy.meta}
      action={
        <Button variant="outline" onClick={handleAdd} disabled={disabled}>
          <Plus />
          {copy.add}
        </Button>
      }
      flush={value.length > 0}
    >
      {value.length === 0 ? (
        <p className="text-body text-muted-foreground">{copy.none}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">{copy.columns.name}</TableHead>
              <TableHead className="hidden md:table-cell">{copy.columns.condition}</TableHead>
              <TableHead>{copy.columns.price}</TableHead>
              <TableHead className="hidden lg:table-cell">{copy.columns.delivery}</TableHead>
              <TableHead className="w-0 pr-5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {value.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="pl-5">
                  <button
                    type="button"
                    className="text-left text-body-strong text-ink-strong underline-offset-4 hover:underline"
                    onClick={() => handleEdit(r)}
                  >
                    {r.name}
                  </button>
                  <div className="text-caption text-muted-foreground md:hidden">
                    {describeCondition(r)}
                  </div>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {describeCondition(r)}
                </TableCell>
                <TableCell className="whitespace-normal">{describePrice(r)}</TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {describeDelivery(r)}
                </TableCell>
                <TableCell className="pr-5">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={copy.edit(r.name)}
                      onClick={() => handleEdit(r)}
                      disabled={disabled}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={copy.remove(r.name)}
                      onClick={() => handleRemove(r.key)}
                      disabled={disabled}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <RateDialog open={open} rate={editing} onOpenChange={setOpen} onDone={handleDone} />
    </DataCard>
  )
}
