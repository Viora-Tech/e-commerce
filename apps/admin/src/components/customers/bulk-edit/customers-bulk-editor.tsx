'use client'

import type { CustomerSheetRow } from '@commerce/api'
import type { ConsentChannel } from '@commerce/core/privacy'
import { CircleAlert, Layers, Save } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import { useHiddenColumns } from '@/components/products/bulk-edit/use-hidden-columns'
import { customersBulkEditContent } from '@/data/customers-bulk-edit'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import CustomersBulkColumnsMenu from './customers-bulk-columns-menu'
import CustomersBulkGrid from './customers-bulk-grid'
import {
  type CellErrors,
  defaultHiddenKeys,
  dirtyCount,
  errorKey,
  type GridRow,
  shownKeys,
  toGridRow,
  validateRows,
} from './customers-bulk-model'
import { dirtyRows, saveRows } from './customers-bulk-save'
import { applyToAll, type SetAllChange, setAllKeys } from './customers-bulk-set-all'
import CustomersBulkSetAllDialog from './customers-bulk-set-all-dialog'

type CustomersBulkEditorProps = {
  sheet: CustomerSheetRow[]
  /** Channels the store can send on; consent columns for the rest are hidden. */
  sendable: readonly ConsentChannel[]
}

const SHOWN_ERRORS = 5

/** Where this browser remembers the columns switched off in the Columns menu (#1000). */
const HIDDEN_COLUMNS_KEY = 'customers-bulk-edit:hidden-columns'

const baseOf = (rows: GridRow[]) => new Map(rows.map((r) => [r.id, r]))

/** Content of `/customers/bulk-edit`: header, error summary and the grid; one Save sends it all. */
export default function CustomersBulkEditor({ sheet, sendable }: CustomersBulkEditorProps) {
  // Hooks
  const copy = useCopy(customersBulkEditContent)
  const [initial] = useState(() => sheet.map(toGridRow))
  const [base, setBase] = useState(() => baseOf(initial))
  const [rows, setRows] = useState(initial)
  const [serverErrors, setServerErrors] = useState<CellErrors>(new Map())
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [setAllOpen, setSetAllOpen] = useState(false)
  const { hidden, toggle } = useHiddenColumns(HIDDEN_COLUMNS_KEY, defaultHiddenKeys(sendable))

  // Helpers
  const label = (key: string) => {
    const [id = '', column = ''] = key.split('|')
    const names = copy.columns as Record<string, string>
    const row = rows.find((r) => r.id === id)
    return { customer: row?.email || row?.name || '', name: names[column] ?? column }
  }

  // Event handlers
  const handleRowsChange = (next: GridRow[]) => setRows(next)

  const handleSetAll = (change: SetAllChange) => {
    setRows(applyToAll(rows, change))
    setSetAllOpen(false)
    toast.success(copy.setAll.applied(rows.length))
  }

  const handleDiscard = () => {
    setRows(rows.map((r) => base.get(r.id) ?? r))
    setServerErrors(new Map())
    setAttempted(false)
  }

  const handleSave = async () => {
    setAttempted(true)
    if (validation.size > 0) return
    const todo = dirtyRows(rows, base)
    if (todo.length === 0) return
    setSaving(true)
    try {
      const results = await saveRows(todo, base, copy.errors.saveFailed)
      const nextBase = new Map(base)
      const failures: CellErrors = new Map()
      for (const res of results) {
        const saved = todo.find((r) => r.id === res.id)
        const old = base.get(res.id)
        if (saved && old) {
          const patch = Object.fromEntries(res.done.map((k) => [k, saved[k as keyof GridRow]]))
          nextBase.set(res.id, { ...old, ...patch })
        }
        if (res.error) failures.set(errorKey(res.id, 'row'), copy.errors.rowFailed(res.error))
      }
      const failed = failures.size
      setBase(nextBase)
      setServerErrors(failures)
      setAttempted(failed > 0)
      const message = copy.toasts.saved(results.length - failed, failed)
      if (failed > 0) toast.error(message)
      else toast.success(message)
    } catch {
      toast.error(copy.errors.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const validation = validateRows(rows, base, copy.validation)
  const errors: CellErrors = new Map([...validation, ...serverErrors])
  const changed = dirtyCount(rows, base)
  const shown = attempted ? [...validation] : []
  const keys = shownKeys(hidden)
  const changeKeys = setAllKeys(keys)
  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-4 pb-6 md:px-6 md:pt-5 md:pb-8">
      <PageHeader
        title={copy.title}
        summary={copy.summary(rows.length)}
        back={{ label: copy.back, href: routes.customers.list() }}
        actions={
          <>
            <span className="text-caption text-muted-foreground">
              {changed > 0 ? copy.unsaved(changed) : copy.noChanges}
            </span>
            <CustomersBulkColumnsMenu hidden={hidden} sendable={sendable} onToggle={toggle} />
            <Button variant="outline" disabled={saving} onClick={() => setSetAllOpen(true)}>
              <Layers aria-hidden="true" />
              {copy.setAll.trigger}
            </Button>
            <Button variant="outline" disabled={changed === 0 || saving} onClick={handleDiscard}>
              {copy.discard}
            </Button>
            <Button disabled={changed === 0} loading={saving} onClick={handleSave}>
              <Save aria-hidden="true" />
              {saving ? copy.saving : copy.save}
            </Button>
          </>
        }
      />
      <p className="text-caption text-muted-foreground">{copy.hint}</p>
      {shown.length > 0 ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{copy.errors.heading(shown.length)}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {shown.slice(0, SHOWN_ERRORS).map(([key, message]) => {
                const { customer, name } = label(key)
                return <li key={key}>{copy.errors.rowLabel(customer, name, message)}</li>
              })}
              {shown.length > SHOWN_ERRORS ? (
                <li>{copy.errors.more(shown.length - SHOWN_ERRORS)}</li>
              ) : null}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      <CustomersBulkGrid
        rows={rows}
        base={base}
        errors={errors}
        keys={keys}
        onRowsChange={handleRowsChange}
      />
      <CustomersBulkSetAllDialog
        open={setAllOpen}
        count={rows.length}
        keys={changeKeys}
        onOpenChange={setSetAllOpen}
        onApply={handleSetAll}
      />
    </div>
  )
}
