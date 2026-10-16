'use client'

import { CircleAlert } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import ProoflyPageHeader from '@/components/layout/proofly-page-header'
import { bulkEditContent } from '@/data/bulk-edit'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import BulkColumnsMenu from './bulk-columns-menu'
import { columnKeys, isEditableKey } from './bulk-edit-columns'
import BulkEditGrid from './bulk-edit-grid'
import {
  type CellErrors,
  dirtyCount,
  errorKey,
  type GridRow,
  gridColumnOf,
  type SheetCollection,
  type SheetRow,
  toGridRow,
} from './bulk-edit-model'
import { toBulkRows } from './bulk-edit-payload'
import { validateRows } from './bulk-edit-validate'
import { useHiddenColumns } from './use-hidden-columns'

export type BulkEditSheet = {
  locations: { id: string; name: string; isDefault: boolean }[]
  collections: SheetCollection[]
  rows: SheetRow[]
  truncated: boolean
}

type BulkEditorProps = {
  sheet: BulkEditSheet
  /** The product ids the sheet was loaded for, to reload it after an undo. */
  productIds: string[]
}

const SHOWN_ERRORS = 5

const locationIdsOf = (sheet: BulkEditSheet) => sheet.locations.map((l) => l.id)

const baseOf = (rows: GridRow[]) => new Map(rows.map((r) => [r.variantId, r]))

/** Content of `/products/bulk-edit`: header, error summary and the grid; one Save sends it all. */
export default function BulkEditor({ sheet, productIds }: BulkEditorProps) {
  // Hooks
  const copy = useCopy(bulkEditContent)
  const [initial, setInitial] = useState(() =>
    sheet.rows.map((r) => toGridRow(r, locationIdsOf(sheet), sheet.collections)),
  )
  const [base, setBase] = useState(() => baseOf(initial))
  const [rows, setRows] = useState(initial)
  const [serverErrors, setServerErrors] = useState<CellErrors>(new Map())
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const { hidden, toggle } = useHiddenColumns()

  // Helpers
  const label = (key: string) => {
    const [variantId = '', column = ''] = key.split('|')
    const row = rows.find((r) => r.variantId === variantId)
    const name = column.startsWith('stock:')
      ? copy.columns.stock(sheet.locations.find((l) => `stock:${l.id}` === column)?.name ?? '')
      : (copy.columns as Record<string, unknown>)[column]
    return { row, name: typeof name === 'string' ? name : column }
  }

  const reload = async () => {
    const fresh = await api.products.bulkEditSheet({ ids: productIds })
    const next = fresh.rows.map((r) => toGridRow(r, locationIdsOf(sheet), sheet.collections))
    setInitial(next)
    setBase(baseOf(next))
    setRows(next)
  }

  // Event handlers
  const handleRowsChange = (next: GridRow[]) => {
    setRows(next)
    setServerErrors(new Map())
  }

  const handleDiscard = () => {
    setRows(initial)
    setServerErrors(new Map())
    setAttempted(false)
  }

  const handleUndo = async (undo: Parameters<typeof api.products.bulkEdit>[0]['rows']) => {
    try {
      const result = await api.products.bulkEdit({ rows: undo })
      if (!result.ok) throw new Error(copy.toasts.undoFailed)
      await reload()
      toast.success(copy.toasts.undone)
    } catch {
      toast.error(copy.toasts.undoFailed)
    }
  }

  const handleSave = async () => {
    setAttempted(true)
    if (validation.size > 0) return
    const payload = toBulkRows(rows, base, locationIdsOf(sheet), sheet.collections)
    if (payload.length === 0) return
    setSaving(true)
    try {
      const result = await api.products.bulkEdit({ rows: payload })
      if (!result.ok) {
        setServerErrors(
          new Map(
            result.errors.map((e) => [errorKey(e.variantId, gridColumnOf(e.field)), e.message]),
          ),
        )
        return
      }
      setInitial(rows)
      setBase(baseOf(rows))
      setServerErrors(new Map())
      setAttempted(false)
      toast.success(
        copy.toasts.saved(result.updatedProducts, result.updatedVariants, result.stockChanges),
        {
          action: { label: copy.toasts.undo, onClick: () => void handleUndo(result.undo) },
          duration: 12_000,
        },
      )
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.errors.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const validation = validateRows(rows, {
    locationIds: locationIdsOf(sheet),
    collections: sheet.collections,
    base,
  })
  const keys = columnKeys(sheet.locations, new Set()).filter(isEditableKey)
  const errors: CellErrors = new Map([...validation, ...serverErrors])
  const changed = dirtyCount(rows, base, keys)
  const products = new Set(rows.map((r) => r.productId)).size
  const shown = attempted || serverErrors.size > 0 ? [...errors] : []
  return (
    <div className="flex w-full flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <ProoflyPageHeader
        title={copy.title}
        summary={copy.summary(products, rows.length)}
        back={{ label: copy.back, href: routes.products.list() }}
        actions={
          <>
            <span className="text-caption text-muted-foreground">
              {changed > 0 ? copy.unsaved(changed) : copy.noChanges}
            </span>
            <BulkColumnsMenu
              hidden={hidden}
              hasStock={sheet.locations.length > 0}
              onToggle={toggle}
            />
            <Button variant="outline" disabled={changed === 0 || saving} onClick={handleDiscard}>
              {copy.discard}
            </Button>
            <Button disabled={changed === 0} loading={saving} onClick={handleSave}>
              {saving ? copy.saving : copy.save}
            </Button>
          </>
        }
      />
      <p className="text-caption text-muted-foreground">{copy.hint}</p>
      {sheet.truncated ? (
        <Alert>
          <CircleAlert />
          <AlertDescription>{copy.truncated(rows.length)}</AlertDescription>
        </Alert>
      ) : null}
      {shown.length > 0 ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{copy.errors.heading(shown.length)}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {shown.slice(0, SHOWN_ERRORS).map(([key, message]) => {
                const { row, name } = label(key)
                return (
                  <li key={key}>
                    {copy.errors.rowLabel(row?.title ?? '', row?.variantTitle ?? '', name, message)}
                  </li>
                )
              })}
              {shown.length > SHOWN_ERRORS ? (
                <li>{copy.errors.more(shown.length - SHOWN_ERRORS)}</li>
              ) : null}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      <BulkEditGrid
        rows={rows}
        base={base}
        errors={errors}
        locations={sheet.locations}
        hidden={hidden}
        onRowsChange={handleRowsChange}
      />
    </div>
  )
}
