'use client'

import { X } from '@commerce/ui/icons'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { productCollectionsContent } from '@/data/collections'
import { useCopy } from '@/hooks/use-copy'
import { withCollection } from './collection-pick'

export type CollectionOption = { id: string; title: string }

type ProductCollectionsFieldProps = {
  /** Manual collections only; automatic membership follows the rules. */
  options: CollectionOption[]
  value: string[]
  onChange: (ids: string[]) => void
}

/** Which manual collections this product sits in, shown in the organisation card. */
export default function ProductCollectionsField({
  options,
  value,
  onChange,
}: ProductCollectionsFieldProps) {
  // Hooks
  const copy = useCopy(productCollectionsContent)

  // Event handlers
  /* Base UI also calls this with `null` when its item list changes (the picked collection
     leaves `available`); only a real option may join the list (#804). */
  const handleAdd = (id: unknown) => {
    const next = withCollection(value, options, id)
    if (next !== value) onChange(next)
  }

  const handleRemove = (id: string) => onChange(value.filter((v) => v !== id))

  // Early returns
  if (options.length === 0) return null

  // Render logic
  const available = options.filter((o) => !value.includes(o.id))
  const picked = value
    .map((id) => options.find((o) => o.id === id))
    .filter((o): o is CollectionOption => o !== undefined)

  return (
    <Field>
      <FieldLabel htmlFor="product-collections">{copy.label}</FieldLabel>
      {picked.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {picked.map((c) => (
            <li
              key={c.id}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-caption"
            >
              {c.title}
              <button
                type="button"
                onClick={() => handleRemove(c.id)}
                aria-label={`${copy.label}: ${c.title}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {available.length > 0 ? (
        <Select<string> value={null} onValueChange={handleAdd}>
          <SelectTrigger id="product-collections" className="w-full">
            <SelectValue placeholder={copy.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {available.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <FieldDescription>{copy.help}</FieldDescription>
    </Field>
  )
}
