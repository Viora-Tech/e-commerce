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
import { deliveryRuleFormContent } from '@/data/delivery-rule-form'
import { discountFormContent } from '@/data/discounts'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { courierRows } from './courier-rows'
import RuleCourierChips from './rule-courier-chips'
import { draftOf, type RuleDraft, ruleErrors, ruleInputOf, withValidPreferred } from './rule-draft'
import RuleMoreFields from './rule-more-fields'
import { applyPreset, type RulePreset, ruleChips, seededDraft } from './rule-presets'
import RulePresetsBar from './rule-presets-bar'
import RulePreviewLine from './rule-preview-line'
import RulePriceFields from './rule-price-fields'
import RuleProductsField from './rule-products-field'
import RuleRouteChoices from './rule-route-choices'
import RuleRoutesFields from './rule-routes-fields'
import RuleStep from './rule-step'
import { useRouteCatalogue } from './use-delivery-overview'

type RuleDialogProps = {
  open: boolean
  /** The rule being edited; null adds one. */
  rule: RouteRule | null
  options: DeliveryOption[]
  /** A new rule's first fields, from a suggestion (Shipping rates); ignored when editing. */
  seed?: Partial<RuleDraft> | null | undefined
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

/**
 * Add or edit a product route rule in four numbered steps (owner, 20 Nov 2026): which products,
 * which couriers shoppers can choose from (toggle chips of the connected couriers and speeds,
 * all ticked on a new rule), which courier is included in the price (Recommended; "only this
 * one"), and what it costs (normal, Free, Fixed ₹, free above ₹X). More holds insurance, the
 * options and Through; "Shoppers will see" prices an example list. A new rule offers three
 * quick starts. A rule whose routes can't be said as chips opens in the detailed route editor.
 */
export default function RuleDialog({
  open,
  rule,
  options,
  seed,
  onOpenChange,
  onSaved,
}: RuleDialogProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const pages = useCopy(deliveryPagesContent)
  const form = useCopy(deliveryRuleFormContent)
  const discountCopy = useCopy(discountFormContent)
  const locale = useLocale()
  const { catalogue, loading, reload } = useRouteCatalogue(open)
  const [draft, setDraft] = useState<RuleDraft>(() => draftOf(rule))
  /** A new rule has had every connected courier ticked (once, when they are known). */
  const [seeded, setSeeded] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!open) return
    setDraft({ ...draftOf(rule), ...(rule ? {} : (seed ?? {})) })
    setSeeded(rule !== null)
    setAttempted(false)
  }, [open, rule, seed])

  useEffect(() => {
    if (!open || seeded || !catalogue) return
    setDraft((d) => seededDraft(d, ruleChips(courierRows(catalogue.routes), [])))
    setSeeded(true)
  }, [open, seeded, catalogue])

  // Helpers
  const patch = (p: Partial<RuleDraft>) => setDraft((d) => withValidPreferred({ ...d, ...p }))

  // Event handlers
  const handlePreset = (preset: RulePreset) => {
    const chips = ruleChips(catalogue ? courierRows(catalogue.routes) : [], draft.chips)
    setDraft((d) => applyPreset(d, preset, chips))
    setSeeded(true)
  }
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
  const chips = ruleChips(catalogue ? courierRows(catalogue.routes) : [], draft.chips)
  const steps = form.steps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent busy={busy} size="wide">
        <DialogHeader>
          <DialogTitle>{rule ? d.editTitle : d.addTitle}</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          {rule ? null : <RulePresetsBar onPick={handlePreset} />}
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
          <RuleStep step={1} title={steps.products}>
            <RuleProductsField
              draft={draft}
              error={errors?.target ?? false}
              onChange={patch}
              onBrowse={() => setPicking(true)}
            />
          </RuleStep>
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
            <>
              <RuleStep step={2} title={steps.couriers} help={steps.couriersHelp}>
                <RuleCourierChips
                  chips={chips}
                  ticked={draft.chips}
                  loading={loading}
                  error={errors?.couriers ?? false}
                  onChange={(next) => patch({ chips: next })}
                  onRetry={reload}
                />
              </RuleStep>
              <RuleStep step={3} title={steps.included} help={steps.includedHelp}>
                <RuleRouteChoices draft={draft} chips={chips} onChange={patch} />
              </RuleStep>
            </>
          )}
          <RuleStep step={draft.custom ? 2 : 4} title={steps.price} help={steps.priceHelp}>
            <RulePriceFields draft={draft} errors={errors} onChange={patch} />
          </RuleStep>
          <RuleMoreFields draft={draft} options={options} onChange={patch} />
          <RulePreviewLine draft={draft} options={options} />
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
