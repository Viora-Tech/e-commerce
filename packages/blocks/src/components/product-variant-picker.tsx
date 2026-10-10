import { mainProductContent as copy } from '../data/zero-drift/main-product'
import type { ProductDetail } from '../types'

type Variant = ProductDetail['variants'][number]

type ProductVariantPickerProps = {
  product: ProductDetail
  variant: Variant | undefined
  onPick: (variantId: string) => void
}

/**
 * The variant to switch to when the shopper picks `valueId` for one option: the one that
 * keeps every other selected value, else any variant carrying the value.
 */
function variantFor(product: ProductDetail, current: Variant | undefined, valueId: string) {
  const option = product.options.find((o) => o.values.some((v) => v.id === valueId))
  const others = (current?.optionValueIds ?? []).filter(
    (id) => !option?.values.some((v) => v.id === id),
  )
  const want = [...others, valueId]
  return (
    product.variants.find((v) => want.every((id) => v.optionValueIds.includes(id))) ??
    product.variants.find((v) => v.optionValueIds.includes(valueId))
  )
}

// Port of snippets/variant-picker.liquid: one fieldset per option, pills (round swatches
// for a Color option are left to the theme CSS's pill look, since we have no swatch data).
// A value is marked unavailable when no variant carrying it can be bought.
export default function ProductVariantPicker({
  product,
  variant,
  onPick,
}: ProductVariantPickerProps) {
  // Early returns
  if (product.options.length === 0 || product.variants.length < 2) return null

  // Render logic
  const selected = new Set(variant?.optionValueIds ?? [])

  return (
    <div className="variant-picker">
      {product.options.map((o) => (
        <fieldset key={o.id} className="variant-picker__option">
          <legend className="variant-picker__option-header">
            <span className="variant-picker__option-name">{o.name}</span>
            <span className="variant-picker__option-value">
              {o.values.find((v) => selected.has(v.id))?.value}
            </span>
          </legend>
          <div className="variant-picker__values">
            {o.values.map((val) => {
              const unavailable = !product.variants.some(
                (v) => v.purchasable && v.optionValueIds.includes(val.id),
              )
              return (
                <label
                  key={val.id}
                  className={`variant-picker__pill${unavailable ? ' is-unavailable' : ''}`}
                >
                  <input
                    type="radio"
                    className="visually-hidden variant-picker__radio"
                    name={o.id}
                    value={val.id}
                    checked={selected.has(val.id)}
                    onChange={() => {
                      const target = variantFor(product, variant, val.id)
                      if (target) onPick(target.id)
                    }}
                  />
                  <span>{val.value}</span>
                  {unavailable ? (
                    <span className="visually-hidden"> — {copy.ui.soldOut}</span>
                  ) : null}
                </label>
              )
            })}
          </div>
        </fieldset>
      ))}
    </div>
  )
}
