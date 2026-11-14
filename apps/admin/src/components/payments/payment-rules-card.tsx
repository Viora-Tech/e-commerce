'use client'

import type { PaymentMethodRule } from '@commerce/core/payment-method-rules'
import { Pencil, Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import { paymentRulesContent } from '@/data/payment-rules'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import PaymentRuleDialog from './payment-rule-dialog'
import type { PaymentsSetup } from './types'

type PaymentRulesCardProps = {
  setup: PaymentsSetup
  onReload: () => Promise<void>
}

/**
 * "Payment rules" (#150, Shopify's payment customizations): rules that hide a way to pay for
 * some orders (cash on delivery above an amount, in some PIN codes, with fragile products).
 * Each row says what it hides and when; Add rule and Edit open a dialog, and every change
 * saves the whole list. The checkout and `placeOrder` both apply them.
 */
export default function PaymentRulesCard({ setup, onReload }: PaymentRulesCardProps) {
  // Hooks
  const copy = useCopy(paymentRulesContent)
  const fmt = useFormat()
  const [rules, setRules] = useState<PaymentMethodRule[]>(setup.methodRules)
  const [editing, setEditing] = useState<PaymentMethodRule | 'new' | null>(null)
  // A fresh dialog (and draft) each time one opens.
  const [opened, setOpened] = useState(0)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<PaymentMethodRule | null>(null)

  // Helpers
  const nameOf = (id: string): string =>
    copy.methodNames[id] ?? setup.gateways.find((g) => g.id === id)?.name ?? id
  const persist = async (next: PaymentMethodRule[], done: string = copy.rules.saved) => {
    const before = rules
    setRules(next)
    setSaving(true)
    try {
      await api.payments.saveMethodRules({ rules: next })
      toast.success(done)
      setEditing(null)
      await onReload()
    } catch {
      setRules(before)
      toast.error(copy.rules.failed)
    } finally {
      setSaving(false)
    }
  }
  const summary = (r: PaymentMethodRule): string => {
    const conditions = [
      r.totalAbovePaise !== null ? copy.rules.above(fmt.money(r.totalAbovePaise)) : null,
      r.totalBelowPaise !== null ? copy.rules.below(fmt.money(r.totalBelowPaise)) : null,
      r.pincodes.length > 0 ? copy.rules.pincodes(r.pincodes.length) : null,
      r.productIds.length > 0 ? copy.rules.products(r.productIds.length) : null,
    ].filter((c): c is string => c !== null)
    const hides = copy.rules.hides(r.methods.map(nameOf).join(', '))
    return `${hides} ${copy.rules.when(conditions.join(', '), r.match === 'all')}`
  }

  // Event handlers
  const handleOpen = (rule: PaymentMethodRule | 'new') => {
    setOpened((n) => n + 1)
    setEditing(rule)
  }
  const handleSave = (rule: PaymentMethodRule) =>
    persist(
      rules.some((r) => r.id === rule.id)
        ? rules.map((r) => (r.id === rule.id ? rule : r))
        : [...rules, rule],
    )
  // Asks first, and says what happened: "Rule deleted", not "Payment rules saved" (#95).
  const handleRemove = async () => {
    if (!deleting) return
    await persist(
      rules.filter((r) => r.id !== deleting.id),
      copy.rules.deleted,
    )
    setDeleting(null)
  }

  // Render logic
  const methods = setup.ruleMethods.map((id) => ({ id, name: nameOf(id) }))

  return (
    <SettingsCard
      title={copy.rules.heading}
      description={copy.rules.description}
      footer={
        <Button variant="outline" onClick={() => handleOpen('new')} disabled={saving}>
          <Plus aria-hidden="true" />
          {copy.rules.add}
        </Button>
      }
    >
      {rules.length === 0 ? (
        <p className="text-body text-muted-foreground">{copy.rules.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-hairline">
          {rules.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-4 py-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="flex items-center gap-2 text-body font-medium">
                  {r.name || copy.rules.untitled}
                  {r.enabled ? null : <StatusChip tone="neutral">{copy.rules.off}</StatusChip>}
                </p>
                <p className="text-caption text-muted-foreground">{summary(r)}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={copy.rules.edit}
                  onClick={() => handleOpen(r)}
                  disabled={saving}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={copy.rules.remove}
                  onClick={() => setDeleting(r)}
                  disabled={saving}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        tone="destructive"
        open={deleting !== null}
        onOpenChange={(open) => (open ? undefined : setDeleting(null))}
        title={copy.rules.deleteDialog.title(deleting?.name || copy.rules.untitled)}
        body={copy.rules.deleteDialog.body}
        confirmLabel={copy.rules.deleteDialog.confirm}
        busy={saving}
        onConfirm={handleRemove}
      />
      <PaymentRuleDialog
        key={opened}
        open={editing !== null}
        rule={editing === 'new' ? null : editing}
        methods={methods}
        saving={saving}
        onOpenChange={(open) => (open ? undefined : setEditing(null))}
        onSave={handleSave}
      />
    </SettingsCard>
  )
}
