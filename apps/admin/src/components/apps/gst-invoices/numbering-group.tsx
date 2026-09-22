'use client'

import {
  financialYear,
  formatSeriesNumber,
  SERIES_KINDS,
  SERIES_RULES,
  type Series,
} from '@commerce/invoices'
import { Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useState } from 'react'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { api } from '@/lib/api-client'
import ChoiceField from './choice-field'
import EditorGroup from './editor-group'
import TextField from './text-field'
import type { GroupProps } from './types'

const copy = gstInvoicesContent.settings.groups.numbering
const kinds = gstInvoicesContent.kinds
const KIND_OPTIONS = SERIES_KINDS.map((k) => ({ value: k, label: kinds[k] }))
const RULE_OPTIONS = SERIES_RULES.map((r) => ({ value: r, label: copy.rules[r] }))
const PADS = [3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }))
const HSN_DIGITS = [4, 6, 8].map((n) => ({ value: String(n), label: String(n) }))

function newSeries(taken: readonly Series[]): Series {
  let n = taken.length + 1
  while (taken.some((s) => s.id === `series-${n}`)) n++
  return {
    id: `series-${n}`,
    name: 'B2B invoices',
    kind: 'tax_invoice',
    rule: 'b2b',
    pattern: 'B2B/{FY}/',
    pad: 4,
  }
}

/**
 * Numbering series: each prints its own prefix, counts on its own and
 * restarts every 1 April. The first series of a kind whose rule matches an
 * order is used, so list B2B before domestic to give business buyers theirs.
 */
export default function NumberingGroup({ settings, onChange, errors }: GroupProps) {
  // Hooks
  const [next, setNext] = useState<Record<string, string>>({})

  useEffect(() => {
    api.gstInvoices
      .seriesNext()
      .then(setNext)
      .catch(() => setNext({}))
  }, [])

  // Helpers
  const setSeries = (series: Series[]) => onChange({ ...settings, series })
  const patch = (i: number, p: Partial<Series>) =>
    setSeries(settings.series.map((s, j) => (j === i ? { ...s, ...p } : s)))

  // Render logic
  const fy = financialYear(new Date())

  return (
    <EditorGroup title={copy.title} body={copy.body}>
      {errors.series ? <p className="text-caption text-destructive">{errors.series}</p> : null}
      <div className="flex flex-col gap-3">
        {settings.series.map((s, i) => (
          <div
            key={s.id}
            className="flex flex-col gap-2 rounded-[0.625rem] border border-border p-3"
          >
            <div className="grid gap-2 sm:grid-cols-[1fr_9rem_9rem]">
              <Input
                size="lg"
                aria-label={copy.name}
                value={s.name}
                maxLength={40}
                onChange={(e) => patch(i, { name: e.target.value })}
              />
              <ChoiceField
                id={`series-kind-${s.id}`}
                label={copy.kind}
                value={s.kind}
                options={KIND_OPTIONS}
                onChange={(v) => patch(i, { kind: v as Series['kind'] })}
              />
              <ChoiceField
                id={`series-rule-${s.id}`}
                label={copy.rule}
                value={s.rule}
                options={RULE_OPTIONS}
                onChange={(v) => patch(i, { rule: v as Series['rule'] })}
              />
            </div>
            <div className="grid items-end gap-2 sm:grid-cols-[1fr_6rem_auto]">
              <TextField
                id={`series-pattern-${s.id}`}
                label={copy.pattern}
                help={copy.patternHelp}
                value={s.pattern}
                maxLength={14}
                onChange={(pattern) => patch(i, { pattern: pattern.toUpperCase() })}
                error={errors[`series.${i}.pattern`]}
              />
              <ChoiceField
                id={`series-pad-${s.id}`}
                label={copy.pad}
                value={String(s.pad)}
                options={PADS}
                onChange={(v) => patch(i, { pad: Number(v) })}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={copy.remove}
                onClick={() => setSeries(settings.series.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </Button>
            </div>
            <p className="font-mono text-caption text-muted-foreground">
              {copy.next(next[s.id] ?? formatSeriesNumber(s, fy, 1))}
            </p>
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => setSeries([newSeries(settings.series), ...settings.series])}
      >
        <Plus />
        {copy.add}
      </Button>
      <div className="grid gap-4 md:grid-cols-2">
        <ChoiceField
          id="gst-hsn-digits"
          label={copy.hsnDigits}
          help={copy.hsnHelp}
          value={String(settings.hsnDigits)}
          options={HSN_DIGITS}
          onChange={(v) => onChange({ ...settings, hsnDigits: Number(v) as 4 | 6 | 8 })}
        />
        <TextField
          id="gst-default-hsn"
          label={copy.defaultHsn}
          help={copy.defaultHsnHelp}
          value={settings.defaultHsn}
          inputMode="numeric"
          maxLength={8}
          onChange={(defaultHsn) => onChange({ ...settings, defaultHsn })}
          error={errors.defaultHsn}
        />
      </div>
    </EditorGroup>
  )
}
