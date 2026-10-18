'use client'

import { Plus } from '@commerce/ui/icons'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy } from '@/hooks/use-copy'
import { CUSTOM_BOX, PRODUCT_BOX, type ShipmentDraft } from './flow-state'

type BoxSelectProps = {
  id: string
  boxes: ShipmentDraft['boxes']
  /** The parcel's products carry their own box size. */
  hasProductBox: boolean
  value: string
  onChange: (boxId: string) => void
}

/**
 * The parcel's box (Figma 618:17577): the store's boxes under "Your boxes" with their sizes on
 * the right, the products' own box, then "+ Custom size for this parcel".
 */
export default function BoxSelect({ id, boxes, hasProductBox, value, onChange }: BoxSelectProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.package)

  // Render logic
  const items: Record<string, string> = {
    [PRODUCT_BOX]: copy.productBox,
    [CUSTOM_BOX]: copy.customBox,
    ...Object.fromEntries(
      boxes.map((b) => [
        b.id,
        copy.boxChosen(b.name, b.lengthCm, b.widthCm, b.heightCm, b.weightGrams),
      ]),
    ),
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>{copy.box}</FieldLabel>
      <Select items={items} value={value || null} onValueChange={(v) => v && onChange(String(v))}>
        <SelectTrigger size="lg" id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {boxes.length || hasProductBox ? (
            <SelectGroup>
              <SelectLabel>{copy.yourBoxes}</SelectLabel>
              {boxes.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  <span className="flex w-full items-center justify-between gap-4">
                    <span>{b.name}</span>
                    <span className="text-caption text-muted-foreground">
                      {copy.boxSize(b.lengthCm, b.widthCm, b.heightCm)}
                    </span>
                  </span>
                </SelectItem>
              ))}
              {hasProductBox ? (
                <SelectItem value={PRODUCT_BOX}>
                  <span className="flex w-full items-center justify-between gap-4">
                    <span>{copy.productBox}</span>
                    <span className="text-caption text-muted-foreground">
                      {copy.productBoxHint}
                    </span>
                  </span>
                </SelectItem>
              ) : null}
            </SelectGroup>
          ) : null}
          {boxes.length || hasProductBox ? <SelectSeparator /> : null}
          <SelectItem value={CUSTOM_BOX}>
            <span className="flex items-center gap-2 text-muted-foreground">
              <Plus aria-hidden className="size-4" />
              {copy.customBoxItem}
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </Field>
  )
}
