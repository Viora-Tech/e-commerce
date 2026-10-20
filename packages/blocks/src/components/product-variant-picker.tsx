import { Fragment } from 'react'
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

/**
 * Round image swatches for an option when each of its values has its own variant image (a
 * colour option with a photo per colour), as the theme's swatch picker; null keeps pills.
 * Values sharing one image (a size, in a product whose images follow colour) are not swatches.
 */
export function swatchImages(
  product: ProductDetail,
  option: ProductDetail['options'][number],
): Map<string, string> | null {
  const images = new Map<string, string>()
  for (const val of option.values) {
    const url = product.variants.find(
      (v) => v.optionValueIds.includes(val.id) && v.imageUrl,
    )?.imageUrl
    if (!url) return null
    images.set(val.id, url)
  }
  return new Set(images.values()).size === images.size && images.size > 0 ? images : null
}

// Port of snippets/variant-picker.liquid: one fieldset per option, the radio before its
// label (the theme CSS styles the checked one as `radio:checked + label`), pills, or round
// image swatches when each value has its own variant image (`swatchImages`). A value is
// marked unavailable when no variant carrying it can be bought.
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
      {product.options.map((o) => {
        const swatches = swatchImages(product, o)
        return (
          <fieldset key={o.id} className="variant-picker__option">
            <legend className="variant-picker__option-header">
              <span className="variant-picker__option-name">{o.name}</span>
              <span className="variant-picker__option-value">
                {o.values.find((v) => selected.has(v.id))?.value}
              </span>
            </legend>
            <div
              className={`variant-picker__values${swatches ? ' variant-picker__values--swatch' : ''}`}
            >
              {o.values.map((val) => {
                const unavailable = !product.variants.some(
                  (v) => v.purchasable && v.optionValueIds.includes(val.id),
                )
                const inputId = `variant-${o.id}-${val.id}`
                const image = swatches?.get(val.id)
                return (
                  <Fragment key={val.id}>
                    <input
                      type="radio"
                      id={inputId}
                      className="visually-hidden variant-picker__radio"
                      name={o.id}
                      value={val.id}
                      checked={selected.has(val.id)}
                      onChange={() => {
                        const target = variantFor(product, variant, val.id)
                        if (target) onPick(target.id)
                      }}
                    />
                    <label
                      htmlFor={inputId}
                      className={`variant-picker__pill${image ? ' variant-picker__swatch' : ''}${unavailable ? ' is-unavailable' : ''}`}
                    >
                      {image ? (
                        <>
                          <span
                            className="variant-picker__swatch-circle"
                            style={{ backgroundImage: `url(${JSON.stringify(image)})` }}
                            aria-hidden="true"
                          />
                          <span className="visually-hidden">{val.value}</span>
                        </>
                      ) : (
                        <span>{val.value}</span>
                      )}
                      {unavailable ? (
                        <span className="visually-hidden"> — {copy.ui.soldOut}</span>
                      ) : null}
                    </label>
                  </Fragment>
                )
              })}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}
