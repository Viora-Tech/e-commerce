'use client'

import type { RolloutAbResults, RolloutView } from '@commerce/core'
import { permissions } from '@commerce/core/permissions'
import { CircleAlert, Plus, Save } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import { rolloutsContent } from '@/data/rollouts'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import AddChangesDialog, { type ChangeKind } from './add-changes-dialog'
import RolloutActions from './rollout-actions'
import RolloutAudienceCard from './rollout-audience-card'
import RolloutBrandingChange from './rollout-branding-change'
import RolloutConflictsBanner from './rollout-conflicts-banner'
import RolloutDetailsCard from './rollout-details-card'
import RolloutDiscountsChange from './rollout-discounts-change'
import {
  emptyRollout,
  endProblem,
  fromRollout,
  type RolloutFormState,
  toRolloutInput,
} from './rollout-form-state'
import RolloutNotesCard from './rollout-notes-card'
import type { RolloutPageData } from './rollout-page-data'
import RolloutResultsCard from './rollout-results-card'
import RolloutScheduleCard from './rollout-schedule-card'
import RolloutStatusChip from './rollout-status-chip'
import RolloutThemeChange from './rollout-theme-change'
import { useRolloutConflicts } from './use-rollout-conflicts'

type RolloutFormProps = {
  /** The rollout being edited; null creates one. */
  rollout: RolloutView | null
  data: RolloutPageData
  /** A started A/B test's numbers per arm. */
  results?: RolloutAbResults | null
}

const initialForm = (r: RolloutView | null): RolloutFormState =>
  r ? fromRollout(r) : emptyRollout()

/**
 * Create or edit a rollout as a full page (no drawers): name and type, its changes (theme,
 * checkout branding, discounts), when it runs and what happens at the end, with the clashes
 * with other rollouts checked as it is edited.
 */
export default function RolloutForm({ rollout, data, results = null }: RolloutFormProps) {
  // Hooks
  const { title: listTitle, form: copy } = useCopy(rolloutsContent)
  const fmt = useFormat()
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const [form, setForm] = useState<RolloutFormState>(() => initialForm(rollout))
  const [saved, setSaved] = useState(() => JSON.stringify(initialForm(rollout)))
  const [discountsOpen, setDiscountsOpen] = useState(() => form.discounts.length > 0)
  const [adding, setAdding] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const conflicts = useRolloutConflicts(form, rollout, hasPermission(permissions.ROLLOUTS_MANAGE))

  // Helpers
  const patch = (p: Partial<RolloutFormState>) => setForm((f) => ({ ...f, ...p }))

  // Event handlers
  const handleSave = async () => {
    setAttempted(true)
    if (!form.name.trim() || endProblem(form)) return
    setBusy(true)
    setServerError(null)
    const input = toRolloutInput(form)
    try {
      if (!rollout) {
        const created = await api.rollouts.create(input)
        setSaved(JSON.stringify(form))
        toast.success(copy.toasts.created)
        router.replace(routes.rollouts.detail(created.id))
        return
      }
      const fresh = await api.rollouts.update({ ...input, id: rollout.id })
      const next = fromRollout(fresh)
      setForm(next)
      setSaved(JSON.stringify(next))
      setAttempted(false)
      toast.success(copy.toasts.saved)
      router.refresh()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : copy.toasts.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => {
    const back = JSON.parse(saved) as RolloutFormState
    setForm(back)
    setDiscountsOpen(back.discounts.length > 0)
    setAttempted(false)
    setServerError(null)
  }

  const handleAdd = (kind: ChangeKind) => {
    setAdding(false)
    if (kind === 'theme') patch({ themeId: '' })
    if (kind === 'checkout' && data.checkout) patch({ branding: data.checkout.branding })
    if (kind === 'discounts') setDiscountsOpen(true)
  }

  // Render logic
  const status = rollout?.status ?? 'draft'
  const canManage = hasPermission(permissions.ROLLOUTS_MANAGE)
  const changesEditable = canManage && (status === 'draft' || status === 'scheduled')
  const dirty = JSON.stringify(form) !== saved
  const ended = status === 'ended' || status === 'archived'
  const nameError = attempted && !form.name.trim()
  const endError = attempted && endProblem(form)
  const showDiscounts = discountsOpen || form.discounts.length > 0
  const added: ChangeKind[] = [
    ...(form.themeId !== null ? (['theme'] as const) : []),
    ...(form.branding ? (['checkout'] as const) : []),
    ...(showDiscounts ? (['discounts'] as const) : []),
  ]
  const noChanges = added.length === 0
  // An A/B test splits theme changes only: the rest apply to every visitor at once.
  const unavailable: ChangeKind[] = [
    ...(data.checkout && !form.audience ? [] : (['checkout'] as const)),
    ...(form.audience ? (['discounts'] as const) : []),
  ]
  const headerActions = rollout ? (
    canManage ? (
      <RolloutActions rollout={rollout} dirty={dirty} />
    ) : null
  ) : canManage ? (
    <Button onClick={handleSave} disabled={busy || !dirty}>
      <Save aria-hidden="true" />
      {copy.saveBar.save}
    </Button>
  ) : null
  const subtitle = rollout?.endedAt
    ? copy.ended(fmt.dateTime(rollout.endedAt))
    : rollout?.startedAt
      ? copy.started(fmt.dateTime(rollout.startedAt))
      : // The schedule card already says times are IST (audit #83: it showed twice).
        undefined

  return (
    // One form column, centred at the width it had beside the Settings nav.
    <PageBody className="mx-auto max-w-[52rem] gap-4">
      <SaveBar
        open={dirty && canManage && !ended}
        message={copy.saveBar.message}
        saveLabel={copy.saveBar.save}
        discardLabel={copy.saveBar.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader
        title={rollout ? rollout.name : copy.newTitle}
        subtitle={subtitle}
        back={{ label: listTitle, href: routes.rollouts.list() }}
        badges={rollout ? <RolloutStatusChip status={rollout.status} /> : undefined}
        actions={headerActions}
      />
      {rollout?.error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{copy.error}</AlertTitle>
          <AlertDescription>{rollout.error}</AlertDescription>
        </Alert>
      ) : null}
      {serverError ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{copy.toasts.failed}</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}
      {changesEditable ? <RolloutConflictsBanner conflicts={conflicts} /> : null}

      <RolloutDetailsCard
        form={form}
        nameError={nameError}
        nameDisabled={!canManage || ended}
        kindDisabled={!changesEditable}
        onChange={patch}
      />

      <RolloutScheduleCard
        form={form}
        endError={endError}
        startDisabled={!changesEditable}
        endDisabled={!canManage || ended}
        onChange={patch}
      />

      <DataCard
        title={copy.changes.heading}
        subtitle={changesEditable || noChanges ? copy.changes.subtitle : copy.changes.locked}
        footer={
          changesEditable ? (
            <Button variant="outline" onClick={() => setAdding(true)} disabled={added.length === 3}>
              <Plus aria-hidden="true" />
              {copy.changes.add}
            </Button>
          ) : null
        }
      >
        {noChanges ? (
          <p className="text-body text-muted-foreground">{copy.changes.empty}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {form.themeId !== null ? (
              <RolloutThemeChange
                themeId={form.themeId}
                themes={data.themes}
                disabled={!changesEditable}
                canCopy={hasPermission(permissions.ONLINE_STORE_WRITE)}
                onChange={(themeId) => patch({ themeId })}
                onRemove={() => patch({ themeId: null })}
              />
            ) : null}
            {form.branding ? (
              <RolloutBrandingChange
                branding={form.branding}
                orderNotes={data.checkout?.orderNotes ?? false}
                storeName={data.checkout?.storeName ?? ''}
                disabled={!changesEditable || !data.checkout}
                onChange={(branding) => patch({ branding })}
                onRemove={() => patch({ branding: null })}
              />
            ) : null}
            {showDiscounts ? (
              <RolloutDiscountsChange
                discounts={form.discounts}
                disabled={!changesEditable}
                onChange={(discounts) => patch({ discounts })}
                onRemove={() => {
                  patch({ discounts: [] })
                  setDiscountsOpen(false)
                }}
              />
            ) : null}
          </div>
        )}
      </DataCard>

      <RolloutAudienceCard
        audience={form.audience}
        markets={data.markets}
        toggleDisabled={!changesEditable}
        audienceLocked={!changesEditable}
        targetDisabled={!canManage || ended}
        onChange={(audience) => patch({ audience })}
      />

      {results && rollout?.startedAt ? (
        <RolloutResultsCard results={results} outcome={rollout.abOutcome} />
      ) : null}

      <RolloutNotesCard
        notes={form.notes}
        disabled={!canManage || ended}
        onChange={(notes) => patch({ notes })}
      />

      <AddChangesDialog
        open={adding}
        added={added}
        unavailable={unavailable}
        onClose={() => setAdding(false)}
        onAdd={handleAdd}
      />
    </PageBody>
  )
}
