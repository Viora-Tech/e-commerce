'use client'

import { CheckIcon, Pencil, RotateCcw, Undo } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import CopyButton from '@/components/fields/copy-button'
import DataCard from '@/components/layout/data-card'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import RelativeTime from '@/components/layout/relative-time'
import LinkRow from '@/components/table/link-row'
import TableEmptyRow from '@/components/table/table-empty-row'
import { shipmentsContent } from '@/data/shipments'
import { shipmentDetailsContent } from '@/data/shipping'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type NdrRow = Awaited<ReturnType<typeof api.shipments.listNdr>>[number]
type Action = 'reattempt' | 'change_address' | 'rto'

const copy = shipmentsContent.ndr

/** Undelivered attempts waiting on a merchant decision: reattempt, re-address, or send it back. */
export default function NdrTab() {
  // Hooks
  const details = useCopy(shipmentDetailsContent)
  const [rows, setRows] = useState<NdrRow[]>([])
  const [dialog, setDialog] = useState<{ row: NdrRow; action: Action } | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    // reloadKey has no bearing on the query; bumping it just re-runs this effect
    // after an NDR action, same idiom as customers-page.tsx.
    if (reloadKey < 0) return
    let cancelled = false
    api.shipments.listNdr().then((r) => {
      if (!cancelled) setRows(r)
    })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // Event handlers
  const handleOpen = (row: NdrRow, action: Action) => {
    setName('')
    setPhone('')
    setAddress('')
    setDialog({ row, action })
  }

  const handleApply = async () => {
    if (!dialog) return
    setBusy(true)
    try {
      await api.shipments.ndrAction({
        shipmentId: dialog.row.id,
        action: dialog.action,
        name: name || undefined,
        phone: phone || undefined,
        address: address || undefined,
      })
      toast.success(copy.applied)
      setDialog(null)
      setReloadKey((k) => k + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <DataCard title={copy.heading} flush>
      <p className="px-4 pt-4 text-body text-muted-foreground">{copy.help}</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{copy.columns.order}</TableHead>
            <TableHead>{copy.columns.waybill}</TableHead>
            <TableHead>{copy.columns.reason}</TableHead>
            <TableHead>{copy.columns.raised}</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? <TableEmptyRow colSpan={5} message={copy.empty} /> : null}
          {rows.map((r) => (
            <LinkRow href={routes.orders.detail(r.orderId)} key={r.id}>
              <TableCell>
                <Link
                  href={routes.orders.detail(r.orderId)}
                  className="font-medium hover:underline"
                >
                  #{r.orderNumber}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-caption">
                <span className="flex items-center gap-1">
                  {r.waybill}
                  <CopyButton value={r.waybill} what={details.awb} visible />
                </span>
              </TableCell>
              <TableCell className="max-w-xs truncate">{r.ndrReason}</TableCell>
              <TableCell>{r.ndrRaisedAt ? <RelativeTime value={r.ndrRaisedAt} /> : null}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpen(r, 'reattempt')}>
                    <RotateCcw aria-hidden="true" />
                    {copy.actions.reattempt}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpen(r, 'change_address')}
                  >
                    <Pencil aria-hidden="true" />
                    {copy.actions.change_address}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleOpen(r, 'rto')}>
                    <Undo aria-hidden="true" />
                    {copy.actions.rto}
                  </Button>
                </div>
              </TableCell>
            </LinkRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog ? copy.actions[dialog.action] : ''}</DialogTitle>
          </DialogHeader>
          {dialog?.action === 'change_address' ? (
            <div className="flex flex-col gap-3">
              <Field>
                <FieldLabel htmlFor="ndr-name">{copy.changeAddressName}</FieldLabel>
                <Input
                  id="ndr-name"
                  size="lg"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ndr-phone">{copy.changeAddressPhone}</FieldLabel>
                <Input
                  id="ndr-phone"
                  size="lg"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ndr-address">{copy.changeAddressAddress}</FieldLabel>
                <Input
                  id="ndr-address"
                  size="lg"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </Field>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={handleApply} disabled={busy}>
              <CheckIcon aria-hidden="true" />
              {copy.apply}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DataCard>
  )
}
