'use client'

import { RETURN_REASONS, type ReturnPolicy, type ReturnReason } from '@commerce/core/returns'
import { Input } from '@commerce/ui/shadcn/input'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import ChoiceList from '@/components/returns/choice-list'
import { returnSettingsContent as copy, returnsContent } from '@/data/returns'
import { SETTINGS_BACK, settingsContent } from '@/data/settings'
import { settingsRowsContent } from '@/data/settings-rows'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import ReturnsRulesCard from './returns-rules-card'
import SettingsCard from './settings-card'
import SettingsDrill from './settings-drill'
import SettingsDrillPanel from './settings-drill-panel'
import SettingsRow from './settings-row'
import SettingsToggleRow from './settings-toggle-row'

const clampDays = (raw: string): number => {
  const n = Math.round(Number(raw))
  return Number.isFinite(n) ? Math.min(90, Math.max(1, n)) : 7
}

/**
 * Settings → Returns, Shopify-style (#147): rows for online requests (window, auto restock), the
 * reasons, exchanges and auto-approval, and the refund default, each opening in place.
 */
export default function ReturnsSettings() {
  // Hooks
  const rowsCopy = useCopy(settingsRowsContent)
  const [form, setForm] = useState<ReturnPolicy | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.returns.policy().then((p) => {
      setForm(p)
      setSaved(JSON.stringify(p))
    })
  }, [])

  // Helpers
  const patch = (p: Partial<ReturnPolicy>) => setForm((f) => (f ? { ...f, ...p } : f))

  // Event handlers
  const handleReason = (code: ReturnReason, on: boolean) => {
    if (!form) return
    const next = on ? [...form.reasons, code] : form.reasons.filter((r) => r !== code)
    patch({ reasons: RETURN_REASONS.filter((r) => next.includes(r)) })
  }

  const handleSave = async () => {
    if (!form) return
    if (form.reasons.length === 0) {
      toast.error(copy.atLeastOne)
      return
    }
    setBusy(true)
    try {
      const next = await api.returns.savePolicy(form)
      setForm(next)
      setSaved(JSON.stringify(next))
      toast.success(copy.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => {
    if (saved) setForm(JSON.parse(saved) as ReturnPolicy)
  }

  // Render logic
  const dirty = form !== null && saved !== null && JSON.stringify(form) !== saved
  const r = rowsCopy.returns
  const rules = form
    ? [form.exchanges ? r.exchanges : null, form.autoApprove.enabled ? r.autoApprove : null]
        .filter(Boolean)
        .join(', ')
    : ''
  const rows = form
    ? [
        {
          id: 'requests',
          title: r.requests,
          value: form.enabled ? r.window(form.windowDays) : rowsCopy.off,
        },
        {
          id: 'reasons',
          title: r.reasons,
          value: r.reasonsValue(form.reasons.length, RETURN_REASONS.length),
        },
        { id: 'rules', title: r.rules, value: rules || rowsCopy.off },
        {
          id: 'refund',
          title: r.refund,
          value: form.refundMethod === 'store_credit' ? r.storeCredit : r.original,
        },
      ]
    : []

  return (
    <div className="flex flex-col gap-6">
      <SaveBar
        open={dirty}
        message={settingsContent.general.unsaved}
        saveLabel={copy.save}
        discardLabel={settingsContent.general.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        back={SETTINGS_BACK}
        save={{ dirty, saving: busy, onSave: handleSave, label: copy.save }}
      />
      {!form ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <SettingsDrill rows={rows} backLabel={r.back}>
          <SettingsDrillPanel id="requests">
            <SettingsCard title={copy.title}>
              <SettingsToggleRow
                id="returns-enabled"
                label={copy.enabled}
                description={copy.enabledHint}
                checked={form.enabled}
                onChange={(enabled) => patch({ enabled })}
              />
              <SettingsRow
                label={copy.window}
                description={copy.windowHint}
                htmlFor="returns-window"
              >
                <div className="flex items-center gap-2">
                  <Input
                    size="lg"
                    id="returns-window"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="90"
                    className="w-24"
                    value={form.windowDays}
                    onChange={(e) => patch({ windowDays: clampDays(e.target.value) })}
                  />
                  <span className="text-body text-muted-foreground">{copy.days}</span>
                </div>
              </SettingsRow>
              <SettingsToggleRow
                id="returns-restock"
                label={copy.restock}
                description={copy.restockHint}
                checked={form.restockAutomatically}
                onChange={(restockAutomatically) => patch({ restockAutomatically })}
              />
            </SettingsCard>
          </SettingsDrillPanel>

          <SettingsDrillPanel id="reasons">
            <SettingsCard title={copy.reasons} description={copy.reasonsHint}>
              {RETURN_REASONS.map((code) => (
                <SettingsToggleRow
                  key={code}
                  id={`reason-${code}`}
                  label={returnsContent.reasons[code]}
                  checked={form.reasons.includes(code)}
                  onChange={(on) => handleReason(code, on)}
                  className="py-3"
                />
              ))}
            </SettingsCard>
          </SettingsDrillPanel>

          <SettingsDrillPanel id="rules">
            <ReturnsRulesCard policy={form} onPatch={patch} />
          </SettingsDrillPanel>

          <SettingsDrillPanel id="refund">
            <SettingsCard title={copy.refund}>
              <ChoiceList
                name="refund-method"
                value={form.refundMethod}
                onChange={(v) =>
                  patch({ refundMethod: v === 'store_credit' ? 'store_credit' : 'original' })
                }
                choices={[
                  { value: 'original', label: copy.refundOptions.original },
                  { value: 'store_credit', label: copy.refundOptions.store_credit },
                ]}
              />
            </SettingsCard>
          </SettingsDrillPanel>
        </SettingsDrill>
      )}
    </div>
  )
}
