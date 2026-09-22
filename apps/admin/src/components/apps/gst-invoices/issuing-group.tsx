'use client'

import { ISSUE_ON } from '@commerce/invoices'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { gstInvoicesContent } from '@/data/gst-invoices'
import ChoiceField from './choice-field'
import EditorGroup from './editor-group'
import TextField from './text-field'
import ToggleRow from './toggle-row'
import type { GroupProps } from './types'

const copy = gstInvoicesContent.settings.groups
const ISSUE_OPTIONS = ISSUE_ON.map((v) => ({ value: v, label: copy.issuing.issueOptions[v] }))
const BARCODE_OPTIONS = (['order', 'document'] as const).map((v) => ({
  value: v,
  label: copy.issuing.barcodeOptions[v],
}))
const EXPORT_OPTIONS = (['lut', 'igst'] as const).map((v) => ({
  value: v,
  label: copy.exports.modes[v],
}))

/** Queue rules, pre-orders, exports, links and the printed terms. */
export default function IssuingGroup({ settings, onChange, errors }: GroupProps) {
  return (
    <>
      <EditorGroup title={copy.issuing.title} body={copy.issuing.body}>
        <ChoiceField
          id="gst-issue-on"
          label={copy.issuing.issueOn}
          value={settings.issueOn}
          options={ISSUE_OPTIONS}
          onChange={(v) => onChange({ ...settings, issueOn: v as typeof settings.issueOn })}
        />
        <ToggleRow
          id="gst-auto-issue"
          label={copy.issuing.autoIssue}
          checked={settings.autoIssue}
          onChange={(autoIssue) => onChange({ ...settings, autoIssue })}
        />
        <TextField
          id="gst-preorder-tag"
          label={copy.issuing.preorderTag}
          help={copy.issuing.preorderTagHelp}
          value={settings.preorderTag}
          maxLength={40}
          onChange={(preorderTag) => onChange({ ...settings, preorderTag })}
        />
        <ToggleRow
          id="gst-preorder-pay"
          label={copy.issuing.preorderAtPayment}
          checked={settings.preorderInvoiceAtPayment}
          onChange={(preorderInvoiceAtPayment) =>
            onChange({ ...settings, preorderInvoiceAtPayment })
          }
        />
        {settings.preorderInvoiceAtPayment ? (
          <p className="rounded-[0.5rem] bg-secondary px-3 py-2 text-caption text-foreground">
            {copy.issuing.preorderAtPaymentWarn}
          </p>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gst-gstr9">{copy.issuing.gstr9}</Label>
          <Input
            id="gst-gstr9"
            size="lg"
            type="date"
            value={settings.gstr9FiledOn ?? ''}
            onChange={(e) => onChange({ ...settings, gstr9FiledOn: e.target.value || null })}
          />
          <span className="text-caption text-muted-foreground">{copy.issuing.gstr9Help}</span>
        </div>
        <ToggleRow
          id="gst-email-link"
          label={copy.issuing.emailLink}
          checked={settings.emailLink}
          onChange={(emailLink) => onChange({ ...settings, emailLink })}
        />
        <ToggleRow
          id="gst-store-link"
          label={copy.issuing.storefrontLink}
          checked={settings.storefrontLink}
          onChange={(storefrontLink) => onChange({ ...settings, storefrontLink })}
        />
        <ChoiceField
          id="gst-barcode"
          label={copy.issuing.barcode}
          value={settings.barcodeValue}
          options={BARCODE_OPTIONS}
          onChange={(v) => onChange({ ...settings, barcodeValue: v as 'order' | 'document' })}
        />
      </EditorGroup>
      <EditorGroup title={copy.exports.title} body={copy.exports.body}>
        <ChoiceField
          id="gst-export-mode"
          label={copy.exports.mode}
          value={settings.exportMode}
          options={EXPORT_OPTIONS}
          onChange={(v) => onChange({ ...settings, exportMode: v as 'lut' | 'igst' })}
        />
        {settings.exportMode === 'lut' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              id="gst-lut"
              label={copy.exports.lutNumber}
              value={settings.lutNumber}
              maxLength={40}
              onChange={(lutNumber) => onChange({ ...settings, lutNumber })}
            />
            <TextField
              id="gst-lut-fy"
              label={copy.exports.lutFy}
              help={copy.exports.lutFyHelp}
              value={settings.lutFy}
              maxLength={7}
              onChange={(lutFy) => onChange({ ...settings, lutFy })}
              error={errors.lutFy}
            />
          </div>
        ) : null}
      </EditorGroup>
      <EditorGroup title={copy.text.title} body={copy.text.body}>
        <TextField
          id="gst-terms"
          label={copy.text.terms}
          value={settings.terms}
          multiline
          maxLength={1000}
          onChange={(terms) => onChange({ ...settings, terms })}
        />
        <TextField
          id="gst-notes"
          label={copy.text.notes}
          value={settings.notes}
          multiline
          maxLength={500}
          onChange={(notes) => onChange({ ...settings, notes })}
        />
        <TextField
          id="gst-footer"
          label={copy.text.footer}
          value={settings.footer}
          maxLength={300}
          onChange={(footer) => onChange({ ...settings, footer })}
        />
      </EditorGroup>
    </>
  )
}
