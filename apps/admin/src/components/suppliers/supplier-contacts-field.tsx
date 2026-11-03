'use client'

import { SUPPLIER_CONTACT_KINDS, type SupplierContactKind } from '@commerce/core/inventory'
import { Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import KitIconButton from '@/components/kit/kit-icon-button'
import { supplierFormContent } from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'

export type ContactDraft = { kind: SupplierContactKind; value: string; label: string }

type SupplierContactsFieldProps = {
  contacts: ContactDraft[]
  onChange: (contacts: ContactDraft[]) => void
}

/** The most a supplier keeps; matches the API's limit. */
const MAX_CONTACTS = 10

/**
 * More ways to reach a supplier beyond the main email and phone (#1064): WhatsApp, WeChat, a
 * second number or email, a website, each with an optional "who" (Sales, Lily).
 */
export default function SupplierContactsField({ contacts, onChange }: SupplierContactsFieldProps) {
  // Hooks
  const { contact: copy } = useCopy(supplierFormContent)

  // Helpers
  const patchAt = (index: number, patch: Partial<ContactDraft>) =>
    onChange(contacts.map((c, i) => (i === index ? { ...c, ...patch } : c)))

  // Render logic
  const items = Object.fromEntries(SUPPLIER_CONTACT_KINDS.map((k) => [k, copy.kinds[k]]))

  return (
    <div className="flex flex-col gap-3">
      <span className="text-body font-medium">{copy.more}</span>
      {contacts.map((c, i) => (
        <div
          // Rows have no id of their own; order is stable while editing.
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are only added at the end or removed
          key={i}
          className="grid grid-cols-[8rem_minmax(0,1fr)_minmax(0,10rem)_2.25rem] items-center gap-2"
        >
          <Select
            items={items}
            value={c.kind}
            onValueChange={(next) => patchAt(i, { kind: String(next) as SupplierContactKind })}
          >
            <SelectTrigger aria-label={copy.kind} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPLIER_CONTACT_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {copy.kinds[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            aria-label={copy.value}
            placeholder={copy.value}
            value={c.value}
            onChange={(e) => patchAt(i, { value: e.target.value })}
          />
          <Input
            aria-label={copy.label}
            placeholder={copy.labelPlaceholder}
            value={c.label}
            onChange={(e) => patchAt(i, { label: e.target.value })}
          />
          <KitIconButton
            label={copy.remove}
            className="size-9"
            onClick={() => onChange(contacts.filter((_, j) => j !== i))}
          >
            <Trash2 aria-hidden="true" />
          </KitIconButton>
        </div>
      ))}
      {contacts.length < MAX_CONTACTS ? (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => onChange([...contacts, { kind: 'whatsapp', value: '', label: '' }])}
        >
          <Plus aria-hidden="true" />
          {copy.add}
        </Button>
      ) : null}
    </div>
  )
}
