'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmActionDialog from '@/components/inventory/confirm-action-dialog'
import type { StoreLocation } from '@/components/inventory/location-select'
import NotesCard from '@/components/inventory/notes-card'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import ProoflyPageBody from '@/components/layout/proofly-page-body'
import { transferFormContent, transfersContent } from '@/data/inventory'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import RouteCard from './route-card'
import TransferLinesCard, { type TransferLine } from './transfer-lines-card'

export type LoadedTransfer = NonNullable<Awaited<ReturnType<typeof api.transfers.get>>>

type TransferFormProps = {
  transfer: LoadedTransfer | null
  locations: StoreLocation[]
}

type Form = { fromLocationId: string; toLocationId: string; note: string; lines: TransferLine[] }

const copy = transferFormContent
const LIST = routes.stock.transfers()

function initialForm(transfer: LoadedTransfer | null, locations: StoreLocation[]): Form {
  if (transfer) {
    return {
      fromLocationId: transfer.fromLocationId,
      toLocationId: transfer.toLocationId,
      note: transfer.note ?? '',
      lines: transfer.lines.map((l) => ({
        variantId: l.variantId,
        productTitle: l.productTitle,
        variantTitle: l.variantTitle,
        sku: l.sku,
        imageUrl: l.imageUrl,
        quantity: String(l.quantity),
        available: null,
      })),
    }
  }
  const home = locations.find((l) => l.fulfilsOnlineOrders) ?? locations[0]
  const other = locations.find((l) => l.id !== home?.id)
  return { fromLocationId: home?.id ?? '', toLocationId: other?.id ?? '', note: '', lines: [] }
}

function toInput(form: Form, id: string | undefined) {
  return {
    id,
    fromLocationId: form.fromLocationId,
    toLocationId: form.toLocationId,
    note: form.note.trim() || undefined,
    lines: form.lines
      .map((l) => ({ variantId: l.variantId, quantity: Number.parseInt(l.quantity, 10) }))
      .filter((l) => Number.isFinite(l.quantity) && l.quantity > 0),
  }
}

/** Create a transfer, ship it out of the origin, then receive it at the destination. */
export default function TransferForm({ transfer, locations }: TransferFormProps) {
  // Hooks
  const router = useRouter()
  const [form, setForm] = useState<Form>(() => initialForm(transfer, locations))
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Helpers
  const patch = (next: Partial<Form>) => setForm((f) => ({ ...f, ...next }))

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    try {
      await work()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  /** Saves the draft; returns its id, or null when there is nothing to move. */
  const persist = async (): Promise<string | null> => {
    const input = toInput(form, transfer?.id)
    if (input.lines.length === 0) {
      toast.error(copy.needLines)
      return null
    }
    return api.transfers.save(input)
  }

  const reopen = (id: string) => (transfer ? router.refresh() : router.replace(`${LIST}/${id}`))

  // Event handlers
  const handleSave = () =>
    run(async () => {
      const id = await persist()
      if (!id) return
      toast.success(transfer ? copy.saved : copy.created)
      reopen(id)
    })

  const handleShip = () =>
    run(async () => {
      const id = await persist()
      if (!id) return
      await api.transfers.ship({ id })
      toast.success(copy.shipped)
      reopen(id)
    })

  const handleReceive = () =>
    run(async () => {
      if (!transfer) return
      await api.transfers.receive({ id: transfer.id })
      toast.success(copy.received)
      router.refresh()
    })

  const handleDelete = () =>
    run(async () => {
      if (!transfer) return
      await api.transfers.delete({ id: transfer.id })
      toast.success(copy.deleted)
      router.push(LIST)
    })

  // Render logic
  const status = transfer?.status ?? null
  const draft = status === null || status === 'draft'
  const sameRoute = form.fromLocationId === form.toLocationId

  return (
    <ProoflyPageBody>
      <PageHeader
        title={transfer ? copy.title(transfer.number) : copy.newTitle}
        summary={status ? transfersContent.status[status] : undefined}
        back={{ label: copy.back, href: LIST }}
        actions={
          draft ? (
            <>
              {transfer ? (
                <Button variant="outline" onClick={() => setConfirmDelete(true)} disabled={busy}>
                  {copy.delete}
                </Button>
              ) : null}
              <Button variant="outline" onClick={handleSave} disabled={busy || sameRoute}>
                {busy ? copy.saving : copy.save}
              </Button>
              <Button onClick={handleShip} disabled={busy || sameRoute}>
                {copy.ship}
              </Button>
            </>
          ) : status === 'in_transit' ? (
            <Button onClick={handleReceive} disabled={busy}>
              {copy.receive}
            </Button>
          ) : null
        }
      />
      {draft ? null : (
        <p className="rounded-lg bg-primary-soft px-4 py-3 text-body text-ink-strong">
          {copy.locked}
        </p>
      )}
      <PageColumns
        main={
          <TransferLinesCard
            lines={form.lines}
            fromLocationId={form.fromLocationId}
            locked={!draft}
            onChange={(lines) => patch({ lines })}
          />
        }
        side={
          <>
            <RouteCard
              locations={locations}
              fromLocationId={form.fromLocationId}
              toLocationId={form.toLocationId}
              disabled={!draft}
              onChange={patch}
            />
            <NotesCard
              id="transfer-note"
              heading={copy.notes.heading}
              placeholder={copy.notes.placeholder}
              value={form.note}
              disabled={!draft}
              onChange={(note) => patch({ note })}
            />
          </>
        }
      />
      <ConfirmActionDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        copy={copy.confirmDelete}
        destructive
        onConfirm={handleDelete}
      />
    </ProoflyPageBody>
  )
}
