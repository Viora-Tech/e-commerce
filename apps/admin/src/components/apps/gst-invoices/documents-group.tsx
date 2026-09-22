'use client'

import {
  DOCUMENT_KINDS,
  type DocumentConfig,
  type DocumentKind,
  FIELD_KEYS,
  LABEL_KEYS,
  TEMPLATE_IDS,
} from '@commerce/invoices'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { Tabs, TabsList, TabsTrigger } from '@commerce/ui/shadcn/tabs'
import { gstInvoicesContent } from '@/data/gst-invoices'
import ChoiceField from './choice-field'
import EditorGroup from './editor-group'
import ToggleRow from './toggle-row'
import type { GroupProps } from './types'

type DocumentsGroupProps = GroupProps & {
  kind: DocumentKind
  onKind: (kind: DocumentKind) => void
}

const copy = gstInvoicesContent.settings.groups.documents
const STORE = 'store'
const TEMPLATE_OPTIONS = [
  { value: STORE, label: copy.sameAsStore },
  ...TEMPLATE_IDS.map((t) => ({ value: t, label: copy.templateNames[t] })),
]

/** Per-document switches: on, template, email attachment, fields and label overrides. */
export default function DocumentsGroup({ settings, onChange, kind, onKind }: DocumentsGroupProps) {
  // Helpers
  const set = (patch: Partial<DocumentConfig>) =>
    onChange({
      ...settings,
      documents: { ...settings.documents, [kind]: { ...settings.documents[kind], ...patch } },
    })

  // Render logic
  const config = settings.documents[kind]

  return (
    <EditorGroup title={copy.title} body={copy.body} defaultOpen>
      <Tabs value={kind} onValueChange={(v) => onKind(v as DocumentKind)}>
        <TabsList className="w-full flex-wrap">
          {DOCUMENT_KINDS.map((k) => (
            <TabsTrigger key={k} value={k}>
              {copy.kinds[k]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <ToggleRow
        id="gst-doc-on"
        label={copy.enabled}
        checked={config.enabled}
        onChange={(enabled) => set({ enabled })}
      />
      {kind !== 'credit_note' && kind !== 'packing_slip' ? (
        <ToggleRow
          id="gst-doc-attach"
          label={copy.attach}
          checked={config.attachToEmail}
          onChange={(attachToEmail) => set({ attachToEmail })}
        />
      ) : null}
      {kind === 'packing_slip' ? (
        <ToggleRow
          id="gst-slip-prices"
          label={copy.packingPrices}
          checked={settings.packingSlipPrices}
          onChange={(packingSlipPrices) => onChange({ ...settings, packingSlipPrices })}
        />
      ) : null}
      <ChoiceField
        id="gst-doc-template"
        label={copy.template}
        value={config.template ?? STORE}
        options={TEMPLATE_OPTIONS}
        onChange={(v) => set({ template: v === STORE ? null : (v as DocumentConfig['template']) })}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-caption font-medium text-muted-foreground">
          {copy.fields}
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {FIELD_KEYS.map((f) => (
            <Label key={f} className="flex items-center gap-2 text-body font-normal">
              <Checkbox
                checked={config.fields[f]}
                onCheckedChange={(v) => set({ fields: { ...config.fields, [f]: Boolean(v) } })}
              />
              {copy.fieldNames[f]}
            </Label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-caption font-medium text-muted-foreground">
          {copy.labels}
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {LABEL_KEYS.map((l) => (
            <Input
              key={l}
              size="lg"
              aria-label={copy.labelNames[l]}
              placeholder={copy.labelNames[l]}
              value={config.labels[l]}
              maxLength={40}
              onChange={(e) => set({ labels: { ...config.labels, [l]: e.target.value } })}
            />
          ))}
        </div>
      </fieldset>
    </EditorGroup>
  )
}
