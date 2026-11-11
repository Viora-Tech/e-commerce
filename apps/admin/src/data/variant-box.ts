/** A variant's own box (#1517): the Box field on its page, its chip and the Shipping tab note. */
export const variantBoxContent = {
  label: 'Box',
  help: 'Pick another named box only when this variant ships in a different box from the rest of the product.',
  /** First option: the variant follows the product's Package. */
  sameAsProduct: (box: string) => `Same as product (${box})`,
  /** The product's Package when it is the store's default box. */
  storeDefault: "store's default box",
  /** The product's Package when it is a custom size. */
  custom: (l: number, w: number, h: number) => `custom ${l} × ${w} × ${h} cm`,
  /** An own box that is a custom size (set from the bulk editor): kept as it is until changed. */
  ownCustom: (l: number, w: number, h: number) => `Own size (${l} × ${w} × ${h} cm)`,
  /** An own box cleared to the store's default (products list, one option value). */
  ownStoreDefault: "Store's default box",
  /** A named box that is no longer in Settings, Shipping & delivery. */
  missing: 'A box that was removed',
  /** Chip in the variants table. */
  chip: 'Own box',
  /** Shipping tab, under the Package picker. */
  ownVariants: (list: string) => `Variants with their own box: ${list}.`,
  allOwn:
    "Every variant has picked its own box, so this package isn't used. Change a variant's box on its page: open it under Variants.",
}
