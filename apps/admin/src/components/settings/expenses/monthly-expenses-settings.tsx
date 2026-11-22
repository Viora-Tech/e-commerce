'use client'

import type { ExpenseVersion } from '@commerce/core/expenses'
import { permissions } from '@commerce/core/permissions'
import { Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import SectionPageSkeleton from '@/components/layout/section-page-skeleton'
import StatStrip from '@/components/layout/stat-strip'
import SettingsLinkRow from '@/components/settings/settings-link-row'
import SettingsList from '@/components/settings/settings-list'
import InlineState from '@/components/states/inline-state'
import { monthlyExpensesContent } from '@/data/monthly-expenses'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
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
  // `retry` reads the list again after a save or delete.
  const { data: view, failed, retry } = useLoad<View>(() => api.monthlyExpenses.list())
  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<ExpenseVersion | null>(null)

  // Helpers
  const monthName = (month: string) =>
    fmt.pattern(`${month}-15T12:00:00Z`, { month: 'short', year: 'numeric' })
  const monthsOf = (e: ExpenseVersion) =>
    e.endsOn === null
      ? copy.from(monthName(e.startsOn))
      : copy.range(monthName(e.startsOn), monthName(e.endsOn))
  const reload = retry

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
      toast.error(errorText(err, copy.failed))
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
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} subtitle={copy.intro} actions={addButton} />
      {failed && !view ? (
        <InlineState kind="error" onRetry={retry} />
      ) : !view ? (
        <SectionPageSkeleton header={false} cards={1} />
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
          <SettingsList
            heading={copy.listTitle}
            description={view.gstClaimable ? copy.gst.claimable : copy.gst.notClaimable}
            after={view.expenses.length === 0 ? <EmptyState heading={copy.empty} /> : undefined}
          >
            {view.expenses.map((e) => (
              <li key={e.id} className="flex items-center">
                <SettingsLinkRow
                  onClick={canManage ? () => setEditing({ expense: e }) : undefined}
                  title={e.name}
                  description={`${copy.categories[e.category]} · ${monthsOf(e)}`}
                  value={<span className="tabular-nums">{fmt.money(e.amountPaise)}</span>}
                />
                {canManage ? (
                  <span className="shrink-0 pr-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={copy.delete}
                      onClick={() => setDeleting(e)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </span>
                ) : null}
              </li>
            ))}
          </SettingsList>
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
