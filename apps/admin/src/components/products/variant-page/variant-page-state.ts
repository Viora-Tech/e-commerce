import { type ProductWrite, variantTitle } from '@commerce/core/catalog'
import { type ProductFormState, toWrite } from '../form-state'

/** Another variant already has this variant's option values: its title, or null. */
export function optionClash(form: ProductFormState, variantId: string): string | null {
  const own = form.variants.find((v) => v.id === variantId)
  if (!own || own.optionValues.length === 0) return null
  const title = variantTitle(own.optionValues)
  const taken = form.variants.some(
    (v) => v.id !== variantId && variantTitle(v.optionValues) === title,
  )
  return taken ? title : null
}

/**
 * The `products.save` payload for a save from one variant's page. It is the product form's own
 * write (`toWrite`), so the server's merge rules for `preorderOverride` and `box_own` apply as
 * they do there, except that stock goes only for this variant and only when it was changed:
 * a sale of another variant since the page loaded is never written back over.
 */
export function variantPageWrite(
  form: ProductFormState,
  saved: ProductFormState,
  variantId: string,
): ProductWrite {
  const write = toWrite(form)
  const before = saved.variants.find((v) => v.id === variantId)
  return {
    ...write,
    variants: write.variants.map((input, i) => {
      const row = form.variants[i]
      const changed = row?.id === variantId && row.quantity !== before?.quantity
      return changed ? input : { ...input, onHand: undefined }
    }),
  }
}

/** The form with one variant gone: what "Delete variant" saves. */
export function withoutVariant(form: ProductFormState, variantId: string): ProductFormState {
  return { ...form, variants: form.variants.filter((v) => v.id !== variantId) }
}
