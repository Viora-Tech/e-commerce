'use client'

import { ISSUE_ON } from '@commerce/invoices'
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

/** When invoices are issued, where links show, and the printed terms. */
export default function IssuingGroup({ settings, onChange }: GroupProps) {
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
