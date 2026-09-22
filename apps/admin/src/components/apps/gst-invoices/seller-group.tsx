'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { useState } from 'react'
import MediaPickDialog from '@/components/media/media-pick-dialog'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { INDIAN_STATES } from '@/data/india'
import ChoiceField from './choice-field'
import EditorGroup from './editor-group'
import TextField from './text-field'
import type { GroupProps, MediaRef } from './types'

type SellerGroupProps = GroupProps & {
  logo: MediaRef
  signature: MediaRef
  onMedia: (slot: 'logo' | 'signature', media: MediaRef) => void
}

type Slot = 'logo' | 'signature'

const copy = gstInvoicesContent.settings.groups.seller
const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s.code, label: s.name }))

/** Supplier identity: legal name, GSTIN, address, logo and signature. */
export default function SellerGroup({
  settings,
  onChange,
  errors,
  logo,
  signature,
  onMedia,
}: SellerGroupProps) {
  // Hooks
  const [picking, setPicking] = useState<Slot | null>(null)

  // Helpers
  const set = (patch: Partial<typeof settings.seller>) =>
    onChange({ ...settings, seller: { ...settings.seller, ...patch } })

  // Event handlers
  const handlePick = (media: MediaRef) => {
    if (picking) onMedia(picking, media)
    setPicking(null)
  }

  // Render logic
  const seller = settings.seller
  const slots: { slot: Slot; label: string; value: MediaRef }[] = [
    { slot: 'logo', label: copy.logo, value: logo },
    { slot: 'signature', label: copy.signature, value: signature },
  ]

  return (
    <EditorGroup title={copy.title} body={copy.body} defaultOpen>
      <TextField
        id="gst-legal-name"
        label={copy.legalName}
        help={copy.legalNameHelp}
        value={seller.legalName}
        onChange={(legalName) => set({ legalName })}
        error={errors['seller.legalName']}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          id="gst-gstin"
          label={copy.gstin}
          help={copy.gstinHelp}
          value={seller.gstin}
          maxLength={15}
          onChange={(gstin) => set({ gstin: gstin.toUpperCase() })}
          error={errors['seller.gstin']}
        />
        <ChoiceField
          id="gst-state"
          label={copy.state}
          placeholder={copy.statePlaceholder}
          value={seller.stateCode}
          options={STATE_OPTIONS}
          onChange={(stateCode) => set({ stateCode })}
        />
      </div>
      <TextField
        id="gst-line1"
        label={copy.line1}
        value={seller.line1}
        onChange={(line1) => set({ line1 })}
      />
      <TextField
        id="gst-line2"
        label={copy.line2}
        value={seller.line2}
        onChange={(line2) => set({ line2 })}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          id="gst-city"
          label={copy.city}
          value={seller.city}
          onChange={(city) => set({ city })}
        />
        <TextField
          id="gst-pincode"
          label={copy.pincode}
          value={seller.pincode}
          inputMode="numeric"
          maxLength={6}
          onChange={(pincode) => set({ pincode })}
          error={errors['seller.pincode']}
        />
        <TextField
          id="gst-email"
          label={copy.email}
          value={seller.email}
          inputMode="email"
          onChange={(email) => set({ email })}
        />
        <TextField
          id="gst-phone"
          label={copy.phone}
          value={seller.phone}
          inputMode="tel"
          onChange={(phone) => set({ phone })}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {slots.map((s) => (
          <Field key={s.slot}>
            <FieldLabel>{s.label}</FieldLabel>
            <div className="flex items-center gap-3 rounded-[0.5rem] border border-dashed border-border p-2">
              <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[0.375rem] bg-muted">
                {s.value ? (
                  // biome-ignore lint/performance/noImgElement: a tiny preview of a library image.
                  <img src={s.value.url} alt="" className="size-full object-contain" />
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setPicking(s.slot)}>
                  {copy.choose}
                </Button>
                {s.value ? (
                  <Button variant="ghost" size="sm" onClick={() => onMedia(s.slot, null)}>
                    {copy.remove}
                  </Button>
                ) : null}
              </div>
            </div>
          </Field>
        ))}
      </div>
      <TextField
        id="gst-signatory"
        label={copy.signatory}
        value={settings.signatoryName}
        onChange={(signatoryName) => onChange({ ...settings, signatoryName })}
      />
      <MediaPickDialog
        open={picking !== null}
        title={picking === 'signature' ? copy.pickSignature : copy.pickLogo}
        empty={copy.pickEmpty}
        onClose={() => setPicking(null)}
        onPick={handlePick}
      />
    </EditorGroup>
  )
}
