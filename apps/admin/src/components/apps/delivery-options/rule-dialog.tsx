'use client'

import type {
  DeliveryOption,
  RouteRule,
  RouteRuleInput,
  RouteSelector,
  RuleTargetKind,
} from '@commerce/core/delivery-options'
import { Save, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Dialog, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import { itemTabs } from '@/components/discounts/pick-sources'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import ResourcePickDialog from '@/components/pickers/resource-pick-dialog'
import SettingsToggleRow from '@/components/settings/settings-toggle-row'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { discountFormContent } from '@/data/discounts'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import RuleRoutesFields from './rule-routes-fields'

type RuleDialogProps = {
  open: boolean
  /** The rule being edited; null adds one. */
  rule: RouteRule | null
  options: DeliveryOption[]
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

type Draft = {
  name: string
  kind: RuleTargetKind
  values: string[]
  text: string
  optionIds: 'all' | string[]
  routes: RouteSelector[]
  defaultIndex: number | null
  alternatives: number[]
  insurance: RouteRuleInput['insurance']
  enabled: boolean
}

const KINDS: RuleTargetKind[] = ['collections', 'products', 'tags', 'types']

const sameSelector = (a: RouteSelector, b: RouteSelector) =>
  a.carrier === b.carrier &&
  (a.channel ?? 'any') === (b.channel ?? 'any') &&
  (a.speed ?? 'any') === (b.speed ?? 'any')

function draftOf(rule: RouteRule | null): Draft {
  if (!rule) {
    return {
      name: '',
      kind: 'collections',
      values: [],
      text: '',
      optionIds: 'all',
      routes: [{ carrier: 'delhivery', channel: 'any', speed: 'any' }],
      defaultIndex: null,
      alternatives: [],
      insurance: 'follow_option',
      enabled: true,
    }
  }
  const indexOf = (s: RouteSelector) => rule.routes.findIndex((r) => sameSelector(r, s))
  const def = rule.defaultRoute ? indexOf(rule.defaultRoute) : -1
  return {
    name: rule.name,
    kind: rule.target.kind,
    values: rule.target.values,
    text: rule.target.values.join('\n'),
    optionIds: rule.optionIds,
    routes: rule.routes,
    defaultIndex: def >= 0 ? def : null,
    alternatives: rule.alternatives.map(indexOf).filter((i) => i >= 0),
    insurance: rule.insurance,
    enabled: rule.enabled,
  }
}

const picks = (kind: RuleTargetKind) => kind === 'products' || kind === 'collections'

/** Add or edit a product route rule: target, options, allowed routes, default, alternatives. */
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
  const [draft, setDraft] = useState<Draft>(() => draftOf(rule))
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
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }))
  const values = () =>
    picks(draft.kind)
      ? draft.values
      : draft.text
          .split('\n')
          .map((v) => v.trim())
          .filter(Boolean)

  // Event handlers
  const handleOption = (id: string, on: boolean) => {
    const current = draft.optionIds === 'all' ? [] : draft.optionIds
    const next = on ? [...current, id] : current.filter((x) => x !== id)
    patch({ optionIds: next.length ? next : 'all' })
  }
  const handleSave = async () => {
    setAttempted(true)
    if (!draft.name.trim() || values().length === 0 || draft.routes.length === 0) return
    const input: RouteRuleInput = {
      name: draft.name.trim(),
      target: { kind: draft.kind, values: values() },
      optionIds: draft.optionIds,
      routes: draft.routes,
      defaultRoute: draft.defaultIndex === null ? null : (draft.routes[draft.defaultIndex] ?? null),
      alternatives: draft.alternatives.flatMap((i) => draft.routes[i] ?? []),
      insurance: draft.insurance,
      enabled: draft.enabled,
    }
    setBusy(true)
    try {
      await api.deliveryOptions.saveRule({ id: rule?.id ?? null, rule: input })
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
  const errors = attempted
    ? {
        name: draft.name.trim() ? null : d.errors.name,
        target: values().length ? null : d.errors.target,
        routes: draft.routes.length ? null : d.errors.routes,
      }
    : { name: null, target: null, routes: null }
  const tabs = itemTabs(discountCopy.value, locale).filter((t) => t.key === draft.kind)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="wide">
        <DialogHeader>
          <DialogTitle>{rule ? d.editTitle : d.addTitle}</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field data-invalid={errors.name ? true : undefined}>
            <FieldLabel htmlFor="rule-name">{d.name}</FieldLabel>
            <Input
              id="rule-name"
              value={draft.name}
              placeholder={d.namePlaceholder}
              onChange={(e) => patch({ name: e.target.value })}
            />
            {errors.name ? <FieldError>{errors.name}</FieldError> : null}
          </Field>
          <ChoiceField
            id="rule-kind"
            label={d.target}
            value={draft.kind}
            options={KINDS.map((k) => ({ value: k, label: d.targetKinds[k] }))}
            onChange={(k) => patch({ kind: k as RuleTargetKind, values: [], text: '' })}
          />
          <Field data-invalid={errors.target ? true : undefined}>
            {picks(draft.kind) ? (
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => setPicking(true)}>
                  {d.browse}
                </Button>
                <span className="text-body text-muted-foreground">
                  {d.picked(draft.values.length)}
                </span>
              </div>
            ) : (
              <>
                <FieldLabel htmlFor="rule-values">{d.values}</FieldLabel>
                <Textarea
                  id="rule-values"
                  value={draft.text}
                  onChange={(e) => patch({ text: e.target.value })}
                />
              </>
            )}
            {errors.target ? <FieldError>{errors.target}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel>{d.options}</FieldLabel>
            <label
              htmlFor="rule-all-options"
              className="flex cursor-pointer items-center gap-2 text-body"
            >
              <Checkbox
                id="rule-all-options"
                checked={draft.optionIds === 'all'}
                onCheckedChange={(v) => (v ? patch({ optionIds: 'all' }) : null)}
              />
              {d.allOptions}
            </label>
            {options.map((o) => (
              <label
                key={o.id}
                htmlFor={`rule-option-${o.id}`}
                className="flex cursor-pointer items-center gap-2 text-body"
              >
                <Checkbox
                  id={`rule-option-${o.id}`}
                  checked={draft.optionIds !== 'all' && draft.optionIds.includes(o.id)}
                  onCheckedChange={(v) => handleOption(o.id, Boolean(v))}
                />
                {o.name}
              </label>
            ))}
          </Field>
          <RuleRoutesFields
            routes={draft.routes}
            defaultIndex={draft.defaultIndex}
            alternatives={draft.alternatives}
            error={errors.routes}
            onChange={(next) => patch(next)}
          />
          <ChoiceField
            id="rule-insurance"
            label={d.insurance}
            value={draft.insurance}
            options={[
              { value: 'follow_option', label: d.followOption },
              { value: 'required', label: d.required },
            ]}
            onChange={(v) => patch({ insurance: v === 'required' ? 'required' : 'follow_option' })}
          />
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
          <Button onClick={handleSave} disabled={busy}>
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
            patch({ values: r.ids })
            setPicking(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
