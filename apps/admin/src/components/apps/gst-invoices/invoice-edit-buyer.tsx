'use client'

import { GST_STATE_CODES, gstState } from '@commerce/core/gstin'
import { FieldLabel } from '@commerce/ui/shadcn/field'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { gstInvoiceEditContent } from '@/data/gst-invoice-edit'
import { useCopy } from '@/hooks/use-copy'
import type { EditForm } from './invoice-edit-form'
import TextField from './text-field'

type InvoiceEditBuyerProps = {
  form: EditForm
  /** An export's place of supply is outside India and is not picked here. */
  exported: boolean
  onChange: (patch: Partial<EditForm>) => void
}

/** States in name order, for the place of supply. */
const STATES = Object.keys(GST_STATE_CODES)
  .flatMap((code) => {
    const s = gstState(code)
    return s ? [s] : []
  })
  .sort((a, b) => a.name.localeCompare(b.name))

/** The sheet's Buyer section: name, address lines, GSTIN and place of supply. */
export default function InvoiceEditBuyer({ form, exported, onChange }: InvoiceEditBuyerProps) {
  // Hooks
  const copy = useCopy(gstInvoiceEditContent.sheet)

  // Render logic
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-body font-medium">{copy.buyer}</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <TextField
          id="edit-buyer-name"
          label={copy.buyerName}
          value={form.name}
          maxLength={200}
          error={form.name.trim() ? undefined : copy.invalid}
          onChange={(name) => onChange({ name })}
        />
        <TextField
          id="edit-buyer-gstin"
          label={copy.gstin}
          help={copy.gstinHelp}
          value={form.gstin}
          maxLength={15}
          onChange={(gstin) => onChange({ gstin: gstin.toUpperCase() })}
        />
        <TextField
          id="edit-buyer-address"
          label={copy.address}
          help={copy.addressHelp}
          multiline
          value={form.address}
          maxLength={1000}
          onChange={(address) => onChange({ address })}
        />
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="edit-buyer-place">{copy.placeOfSupply}</FieldLabel>
          {exported ? (
            <p className="text-body text-muted-foreground">{copy.exportPlace}</p>
          ) : (
            <NativeSelect
              id="edit-buyer-place"
              value={form.placeOfSupply}
              onChange={(e) => onChange({ placeOfSupply: e.target.value })}
            >
              {STATES.map((s) => (
                <NativeSelectOption key={s.code} value={s.code}>
                  {`${s.name} (${s.gstCode})`}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </div>
      </div>
    </section>
  )
}
