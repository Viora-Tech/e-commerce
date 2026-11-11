import type { BoxPreset } from '@commerce/core'
import type { VariantBox } from '@commerce/core/catalog'
import type { variantBoxContent } from '@/data/variant-box'

/** A box in words: the named box, a custom size, or the store's default (#1517). */
export function boxLabel(
  box: VariantBox,
  presets: readonly BoxPreset[],
  copy: typeof variantBoxContent,
): string {
  const { packageLengthCm: l, packageWidthCm: w, packageHeightCm: h } = box
  if (l && w && h) return copy.custom(l, w, h)
  if (!box.boxPresetId) return copy.storeDefault
  return presets.find((b) => b.id === box.boxPresetId)?.name ?? copy.missing
}
