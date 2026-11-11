'use client'

import type { BoxPreset } from '@commerce/core'
import { type VariantBox, variantBox } from '@commerce/core/catalog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useEffect, useState } from 'react'
import KitField from '@/components/kit/kit-field'
import { variantBoxContent } from '@/data/variant-box'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { boxLabel } from './box-label'
import type { VariantRow } from './form-state'

type VariantBoxFieldProps = {
  draft: VariantRow
  /** The product's Package (Shipping tab), which the variant follows unless it picks its own. */
  productBox: VariantBox
  onPatch: (patch: Partial<VariantRow>) => void
}

const SAME = '__same_as_product'
/** The variant's own box as it stands when it is not one of the named boxes (custom size, store default). */
const CURRENT = '__current_own'

/**
 * A variant's optional own box (#1517): "Same as product" or one of the store's named boxes. The
 * box in use is stored on the variant, so picking "Same as product" copies the product's Package
 * back; sizes stay in the named boxes (Settings, Shipping & delivery).
 */
export default function VariantBoxField({ draft, productBox, onPatch }: VariantBoxFieldProps) {
  // Hooks
  const copy = useCopy(variantBoxContent)
  /* Null until the store's boxes load, so a named box never flashes as "removed". */
  const [loaded, setLoaded] = useState<BoxPreset[] | null>(null)

  useEffect(() => {
    api.store
      .getShipping()
      .then((r) => setLoaded(r.settings.boxPresets ?? []))
      .catch(() => setLoaded([]))
  }, [])

  // Event handlers
  const handleChange = (next: string) => {
    if (next === CURRENT) return
    if (next === SAME) {
      onPatch({ ...productBox, boxOwn: false })
      return
    }
    onPatch({
      boxPresetId: next,
      packageLengthCm: null,
      packageWidthCm: null,
      packageHeightCm: null,
      boxOwn: true,
    })
  }

  // Render logic
  const presets = loaded ?? []
  const own = variantBox(draft)
  const named = loaded === null || presets.some((b) => b.id === own.boxPresetId)
  const value = !draft.boxOwn ? SAME : named && own.boxPresetId ? own.boxPresetId : CURRENT
  const { packageLengthCm: l, packageWidthCm: w, packageHeightCm: h } = own
  const currentLabel =
    l && w && h ? copy.ownCustom(l, w, h) : own.boxPresetId ? copy.missing : copy.ownStoreDefault
  const entries: [string, string][] = [
    [SAME, copy.sameAsProduct(boxLabel(productBox, presets, copy))],
    ...(value === CURRENT ? [[CURRENT, currentLabel] as [string, string]] : []),
    ...presets.map((b): [string, string] => [
      b.id,
      `${b.name} (${b.lengthCm} × ${b.widthCm} × ${b.heightCm} cm)`,
    ]),
  ]
  const items = Object.fromEntries(entries)

  return (
    <KitField label={copy.label} help={copy.help} htmlFor="edit-variant-box">
      <Select items={items} value={value} onValueChange={(next) => handleChange(String(next))}>
        <SelectTrigger size="lg" id="edit-variant-box" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {entries.map(([id, label]) => (
            <SelectItem key={id} value={id}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </KitField>
  )
}
