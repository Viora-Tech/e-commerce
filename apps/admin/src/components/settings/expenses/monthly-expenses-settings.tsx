'use client'

import type { ExpenseVersion } from '@commerce/core/expenses'
import { permissions } from '@commerce/core/permissions'
import { Pencil, Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import StatStrip from '@/components/layout/stat-strip'
import SettingsTable from '@/components/settings/settings-table'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import SettingsTableRow from '@/components/settings/settings-table-row'
import { monthlyExpensesContent } from '@/data/monthly-expenses'
import { SETTINGS_BACK } from '@/data/settings'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import ExpenseDialog from './expense-dialog'

type View = Awaited<ReturnType<typeof api.monthlyExpenses.list>>
/** The dialog open: a new expense, or the version being changed. */
type Editing = { expense: ExpenseVersion | null } | null

/**
 * Settings › Monthly expenses: rent, staff, apps and the rest, as versions (an amount changed
 * from a month on starts a new row, so past months keep theirs). Net profit in Analytics takes
 * them off order profit; the month in progress counts the days gone (design 2a).
 */
export default function MonthlyExpensesSettings() {
  // Hooks
  const copy = useCopy(monthlyExpensesContent)
  const fmt = useFormat()
  const { hasPermission } = usePermissions()
  const [view, setView] = useState<View | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<ExpenseVersion | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    // reloadKey re-runs the fetch after a save or delete.
    if (reloadKey < 0) return
    let live = true
    api.monthlyExpenses.list().then((v) => {
      if (live) setView(v)
    })
    return () => {
      live = false
    }
  }, [reloadKey])

  // Helpers
  const monthName = (month: string) =>
    fmt.pattern(`${month}-15T12:00:00Z`, { month: 'short', year: 'numeric' })
  const monthsOf = (e: ExpenseVersion) =>
    e.endsOn === null
      ? copy.from(monthName(e.startsOn))
      : copy.range(monthName(e.startsOn), monthName(e.endsOn))
  const reload = () => setReloadKey((k) => k + 1)

  // Event handlers
  const handleSaved = () => {
    setEditing(null)
    reload()
  }
  const handleDelete = async () => {
    if (!deleting) return
    try {
      await api.monthlyExpenses.delete({ id: deleting.id })
      toast.success(copy.deleted)
      setDeleting(null)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
      throw err
    }
  }

  // Render logic
  const canManage = hasPermission(permissions.SETTINGS_MANAGE)
  const month = view ? view.today.slice(0, 7) : ''
  const addButton = canManage ? (
    <Button onClick={() => setEditing({ expense: null })} disabled={!view}>
      <Plus aria-hidden="true" />
      {copy.add}
    </Button>
  ) : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={copy.title}
        subtitle={copy.intro}
        back={SETTINGS_BACK}
        actions={addButton}
      />
      {!view ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <>
          <StatStrip
            tiles={[
              {
                id: 'this-month',
                label: copy.thisMonth,
                value: fmt.money(view.thisMonth.countedPaise),
                note: copy.thisMonthNote(
                  view.thisMonth.daysCounted,
                  view.thisMonth.daysInMonth,
                  fmt.money(view.thisMonth.fullPaise),
                ),
              },
            ]}
          />
          <SettingsTable
            heading={copy.listTitle}
            description={view.gstClaimable ? copy.gst.claimable : copy.gst.notClaimable}
            columns={[
              { label: copy.columns.name },
              { label: copy.columns.category, className: 'hidden md:table-cell' },
              { label: copy.columns.amount },
              { label: copy.columns.months, className: 'hidden sm:table-cell' },
            ]}
            actions={canManage}
            after={view.expenses.length === 0 ? <EmptyState heading={copy.empty} /> : undefined}
          >
            {view.expenses.map((e) => (
              <SettingsTableRow key={e.id}>
                <SettingsTableCell>{e.name}</SettingsTableCell>
                <SettingsTableCell className="hidden md:table-cell">
                  {copy.categories[e.category]}
                </SettingsTableCell>
                <SettingsTableCell>{fmt.money(e.amountPaise)}</SettingsTableCell>
                <SettingsTableCell className="hidden sm:table-cell">
                  {monthsOf(e)}
                </SettingsTableCell>
                {canManage ? (
                  <SettingsTableCell className="text-right">
                    <span className="inline-flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={copy.edit}
                        onClick={() => setEditing({ expense: e })}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={copy.delete}
                        onClick={() => setDeleting(e)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </span>
                  </SettingsTableCell>
                ) : null}
              </SettingsTableRow>
            ))}
          </SettingsTable>
        </>
      )}
      {editing ? (
        <ExpenseDialog
          expense={editing.expense}
          month={month}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={copy.confirmDelete.title}
        body={copy.confirmDelete.body}
        confirmLabel={copy.confirmDelete.confirm}
        tone="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
