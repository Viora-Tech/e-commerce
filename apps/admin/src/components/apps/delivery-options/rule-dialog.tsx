'use client'

import type { DeliveryOption, RouteRule } from '@commerce/core/delivery-options'
import { Save, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Dialog, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { itemTabs } from '@/components/discounts/pick-sources'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import NoticeBar from '@/components/layout/notice-bar'
import ResourcePickDialog from '@/components/pickers/resource-pick-dialog'
import SettingsToggleRow from '@/components/settings/settings-toggle-row'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { discountFormContent } from '@/data/discounts'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import {
  draftOf,
  type RuleDraft,
  ruleErrors,
  ruleInputOf,
  withValidPreferred,
} from './rule-draft'
import RuleMoreFields from './rule-more-fields'
import RuleRouteChoices from './rule-route-choices'
import RuleRoutesFields from './rule-routes-fields'
import RuleSentence from './rule-sentence'

type RuleDialogProps = {
  open: boolean
  /** The rule being edited; null adds one. */
  rule: RouteRule | null
  options: DeliveryOption[]
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

/**
 * Add or edit a product route rule as a plain sentence (owner, 17 Nov, #1781): "[Glasspads]
 * ship only with [Delhivery]", through which account, which speeds, a preferred courier (and
 * "always by it at the option's price"), and a collapsed More. A rule whose routes can't be
 * said that way opens in the detailed route editor instead. Saves the same rule schema.
 *
 * No live "what this rule gives" line: Try a PIN prices only saved rules (its `draft` takes
 * the layout and options, not rules), so an unsaved rule can't be previewed yet.
 */
export default function RuleDialog({
  open,
  rule,
  options,
  onOpenChange,
  onSaved,
}: RuleDialogProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const pages = useCopy(deliveryPagesContent)
  const discountCopy = useCopy(discountFormContent)
  const locale = useLocale()
  const [draft, setDraft] = useState<RuleDraft>(() => draftOf(rule))
  const [attempted, setAttempted] = useState(false)
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!open) return
    setDraft(draftOf(rule))
    setAttempted(false)
  }, [open, rule])

  // Helpers
  const patch = (p: Partial<RuleDraft>) => setDraft((d) => withValidPreferred({ ...d, ...p }))

  // Event handlers
  const handleSave = async () => {
    setAttempted(true)
    if (Object.values(ruleErrors(draft)).some(Boolean)) return
    setBusy(true)
    try {
      await api.deliveryOptions.saveRule({ id: rule?.id ?? null, rule: ruleInputOf(draft) })
      toast.success(copy.saved)
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }
  const handleDelete = async () => {
    if (!rule) return
    setBusy(true)
    try {
      await api.deliveryOptions.deleteRule({ id: rule.id })
      toast.success(copy.deleted)
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const d = copy.ruleDialog
  const errors = attempted ? ruleErrors(draft) : null
  const tabs = itemTabs(discountCopy.value, locale).filter((t) => t.key === draft.kind)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent busy={busy} size="wide">
        <DialogHeader>
          <DialogTitle>{rule ? d.editTitle : d.addTitle}</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field data-invalid={errors?.name || undefined}>
            <FieldLabel htmlFor="rule-name">{d.name}</FieldLabel>
            <Input
              id="rule-name"
              value={draft.name}
              placeholder={d.namePlaceholder}
              onChange={(e) => patch({ name: e.target.value })}
            />
            {errors?.name ? <FieldError>{d.errors.name}</FieldError> : null}
          </Field>
          <RuleSentence
            draft={draft}
            errors={errors}
            onChange={patch}
            onBrowse={() => setPicking(true)}
          />
          {draft.custom ? (
            <>
              <NoticeBar>{d.custom}</NoticeBar>
              <RuleRoutesFields
                routes={draft.routes}
                defaultIndex={draft.defaultIndex}
                alternatives={draft.alternatives}
                error={errors?.routes ? d.errors.routes : null}
                onChange={(next) => patch(next)}
              />
              {draft.defaultIndex === null ? null : (
                <label
                  htmlFor="rule-force-route-custom"
                  className="flex cursor-pointer items-start gap-2 text-body"
                >
                  <Checkbox
                    id="rule-force-route-custom"
                    className="mt-0.5"
                    checked={draft.forceRoute}
                    onCheckedChange={(v) => patch({ forceRoute: Boolean(v) })}
                  />
                  {d.forceRoute}
                </label>
              )}
            </>
          ) : (
            <RuleRouteChoices
              draft={draft}
              speedsError={errors?.speeds ?? false}
              onChange={patch}
            />
          )}
          <RuleMoreFields draft={draft} options={options} onChange={patch} />
          <SettingsToggleRow
            id="rule-enabled"
            label={d.enabled}
            checked={draft.enabled}
            onChange={(enabled) => patch({ enabled })}
          />
        </FieldGroup>
        <DialogFooter>
          {rule ? (
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() => setConfirming(true)}
              disabled={busy}
            >
              <Trash2 aria-hidden="true" />
              {copy.delete}
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {copy.cancel}
          </Button>
          <Button loading={busy} onClick={handleSave} disabled={busy}>
            <Save aria-hidden="true" />
            {copy.save}
          </Button>
        </DialogFooter>
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={copy.delete}
          body={pages.ruleRows.deleteConfirm}
          confirmLabel={copy.delete}
          tone="destructive"
          onConfirm={handleDelete}
        />
        <ResourcePickDialog
          open={picking}
          title={d.pickTitle}
          tabs={tabs}
          selected={{ tab: draft.kind, ids: draft.values }}
          onClose={() => setPicking(false)}
          onDone={(r) => {
            patch({ values: r.ids, titles: r.items.map((i) => i.title) })
            setPicking(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
