'use client'

import type { EarnRuleRow } from '@commerce/core'
import { X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@commerce/ui/shadcn/sheet'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import StatusChip from '@/components/layout/status-chip'
import { loyaltyRulesContent } from '@/data/loyalty-rules'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { type RuleForm, ruleInputOf, ruleNeedsUrl, validUrl } from '@/lib/loyalty-rules'
import RuleFields from './rule-fields'
import RulePreview from './rule-preview'

type RuleSheetProps = {
  form: RuleForm
  /** The rule's standard name ("Follow on Instagram"). */
  name: string
  onClose: () => void
  onSaved: (row: EarnRuleRow) => void
  onRemoved: (id: string) => void
}

/**
 * One earning rule in a wide side sheet laid out like Essential Loyalty's rule page: the name
 * with Enabled, Disable / Delete / Save on the right; the customer title and the points on the
 * left, the shopper's preview on the right.
 */
export default function RuleSheet({
  form: start,
  name,
  onClose,
  onSaved,
  onRemoved,
}: RuleSheetProps) {
  // Hooks
  const copy = useCopy(loyaltyRulesContent)
  const [form, setForm] = useState(start)
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [leaving, setLeaving] = useState(false)

  // Helpers
  const set = (patch: Partial<RuleForm>) => setForm((f) => ({ ...f, ...patch }))

  // Event handlers
  const handleSave = async () => {
    setBusy(true)
    try {
      const row = await api.loyalty.rules.save({ id: form.id, rule: ruleInputOf(form) })
      toast.success(copy.editor.saved)
      onSaved(row)
    } catch (err) {
      toast.error(errorText(err, copy.editor.failed))
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    if (!form.id) return
    await api.loyalty.rules.remove({ id: form.id })
    toast.success(copy.editor.removed)
    onRemoved(form.id)
  }

  const handleClose = () => {
    if (JSON.stringify(form) !== JSON.stringify(start)) setLeaving(true)
    else onClose()
  }

  // Render logic
  const e = copy.editor
  const urlBad = ruleNeedsUrl(form.type) && !validUrl(form.url)
  const dirty = JSON.stringify(form) !== JSON.stringify(start)
  const title = form.title.trim() || name

  return (
    <>
      <Sheet open onOpenChange={(open) => (!open ? handleClose() : undefined)}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-5xl"
        >
          <div className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 border-b border-line bg-popover px-6 py-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-caption text-muted-foreground">{e.crumb(title)}</span>
              <div className="flex items-center gap-2">
                <SheetTitle className="text-page-title text-ink-strong">
                  {form.id ? title : e.newTitle(name)}
                </SheetTitle>
                <StatusChip tone={form.enabled ? 'success' : 'neutral'}>
                  {form.enabled ? e.enabledChip : e.disabledChip}
                </StatusChip>
              </div>
              <SheetDescription className="text-body text-muted-foreground">
                {copy.hints[form.type]}
              </SheetDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => set({ enabled: !form.enabled })}>
                {form.enabled ? e.disable : e.enable}
              </Button>
              {form.id ? (
                <Button
                  variant="outline"
                  className="text-destructive"
                  onClick={() => setRemoving(true)}
                >
                  {e.delete}
                </Button>
              ) : null}
              <Button
                onClick={handleSave}
                loading={busy}
                disabled={urlBad || form.points < 0 || (Boolean(form.id) && !dirty)}
              >
                {form.id ? e.save : e.add}
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={e.close} onClick={handleClose}>
                <X />
              </Button>
            </div>
          </div>
          <div className="grid items-start gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <RuleFields form={form} name={name} onChange={set} />
            <RulePreview form={form} name={name} />
          </div>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={e.removeTitle}
        body={e.removeBody}
        confirmLabel={e.remove}
        tone="destructive"
        onConfirm={handleRemove}
      />
      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title={e.discardTitle}
        body={e.discardBody}
        confirmLabel={e.discard}
        tone="destructive"
        onConfirm={onClose}
      />
    </>
  )
}
