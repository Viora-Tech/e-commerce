'use client'

import { Card } from '@commerce/ui/shadcn/card'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import type { DraftFormState } from '@/components/drafts/draft-form-state'
import { draftEditorContent as copy } from '@/data/drafts'
import { INDIAN_STATES } from '@/data/india'

type DraftAddressCardProps = {
  address: DraftFormState['address']
  onChange: (address: DraftFormState['address']) => void
}

const stateItems = INDIAN_STATES.map((s) => ({ value: s.code, label: s.name }))

export default function DraftAddressCard({ address, onChange }: DraftAddressCardProps) {
  // Helpers
  const set = (key: keyof DraftFormState['address']) => (value: string) =>
    onChange({ ...address, [key]: value })

  // Render logic
  return (
    <Card className="gap-4 p-5">
      <p className="text-kit-card-title text-foreground">{copy.address.heading}</p>
      <Field>
        <FieldLabel htmlFor="draft-addr-name">{copy.address.name}</FieldLabel>
        <Input
          id="draft-addr-name"
          value={address.name}
          onChange={(e) => set('name')(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="draft-addr-line1">{copy.address.line1}</FieldLabel>
        <Input
          id="draft-addr-line1"
          value={address.line1}
          onChange={(e) => set('line1')(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="draft-addr-line2">{copy.address.line2}</FieldLabel>
        <Input
          id="draft-addr-line2"
          value={address.line2}
          onChange={(e) => set('line2')(e.target.value)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="draft-addr-city">{copy.address.city}</FieldLabel>
          <Input
            id="draft-addr-city"
            value={address.city}
            onChange={(e) => set('city')(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="draft-addr-state">{copy.address.state}</FieldLabel>
          <Select
            items={stateItems}
            value={address.stateCode}
            onValueChange={(code) => code && set('stateCode')(String(code))}
          >
            <SelectTrigger id="draft-addr-state" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stateItems.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="draft-addr-pincode">{copy.address.pincode}</FieldLabel>
          <Input
            id="draft-addr-pincode"
            inputMode="numeric"
            value={address.pincode}
            onChange={(e) => set('pincode')(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="draft-addr-phone">{copy.address.phone}</FieldLabel>
        <Input
          id="draft-addr-phone"
          value={address.phone}
          onChange={(e) => set('phone')(e.target.value)}
        />
      </Field>
    </Card>
  )
}
