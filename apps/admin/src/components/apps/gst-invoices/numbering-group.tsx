'use client'

import { financialYear, formatDocumentNumber } from '@commerce/invoices'
import { gstInvoicesContent } from '@/data/gst-invoices'
import ChoiceField from './choice-field'
import EditorGroup from './editor-group'
import TextField from './text-field'
import ToggleRow from './toggle-row'
import type { GroupProps } from './types'

const copy = gstInvoicesContent.settings.groups.numbering
const PADS = [3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }))
const HSN_DIGITS = [4, 6, 8].map((n) => ({ value: String(n), label: String(n) }))

/** Prefixes, digit count, FY in the number, HSN length: with a live next-number preview. */
export default function NumberingGroup({ settings, onChange, errors }: GroupProps) {
  // Render logic
  const next = formatDocumentNumber({
    prefix: settings.invoicePrefix || 'INV',
    fy: financialYear(new Date()),
    seq: 1,
    pad: settings.pad,
    includeFy: settings.includeFy,
  })

  return (
    <EditorGroup title={copy.title} body={copy.body}>
      <div className="grid gap-4 md:grid-cols-3">
        <TextField
          id="gst-prefix"
          label={copy.invoicePrefix}
          value={settings.invoicePrefix}
          maxLength={10}
          onChange={(v) => onChange({ ...settings, invoicePrefix: v.toUpperCase() })}
          error={errors.invoicePrefix}
        />
        <TextField
          id="gst-cn-prefix"
          label={copy.creditNotePrefix}
          value={settings.creditNotePrefix}
          maxLength={10}
          onChange={(v) => onChange({ ...settings, creditNotePrefix: v.toUpperCase() })}
          error={errors.creditNotePrefix}
        />
        <ChoiceField
          id="gst-pad"
          label={copy.pad}
          value={String(settings.pad)}
          options={PADS}
          onChange={(v) => onChange({ ...settings, pad: Number(v) })}
        />
      </div>
      <ToggleRow
        id="gst-include-fy"
        label={copy.includeFy}
        checked={settings.includeFy}
        onChange={(includeFy) => onChange({ ...settings, includeFy })}
      />
      <p className="rounded-[0.5rem] bg-muted px-3 py-2 font-mono text-caption text-foreground">
        {copy.next(next)}
      </p>
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
