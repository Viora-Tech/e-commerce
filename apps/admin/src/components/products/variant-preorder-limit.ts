/** A variant's own pre-order limit on its page (#1536): what it may hold and what a blank one uses. */
import type { ProductFormState } from './form-state'

/** A variant's pre-order limit as typed: blank, or a whole number from 1 to 1,000,000. */
export function validVariantLimit(text: string): boolean {
  if (text.trim() === '') return true
  const n = Number(text)
  return Number.isInteger(n) && n >= 1 && n <= 1_000_000
}

/**
 * What a variant with a blank pre-order limit uses, for the field's placeholder: the product's
 * own limit (null: none), or the campaign's when the product is in one and does not keep its own.
 */
export function inheritedPreorderLimit(
  form: Pick<ProductFormState, 'preorderCampaignId' | 'preorderOwn' | 'preorderLimit'>,
): { from: 'product'; limit: number | null } | { from: 'campaign' } {
  if (form.preorderCampaignId && !form.preorderOwn.includes('limit')) return { from: 'campaign' }
  const n = Number(form.preorderLimit)
  const limit = form.preorderLimit.trim() !== '' && Number.isInteger(n) && n >= 1 ? n : null
  return { from: 'product', limit }
}

/** What the variant page needs to show the pre-order limit field and its placeholder. */
export type VariantPreorderContext = {
  /** The product takes pre-orders (its own switch or a campaign). */
  on: boolean
  inherited: ReturnType<typeof inheritedPreorderLimit>
}

/** The variant page's pre-order context for this form. */
export function variantPreorderContext(
  form: Pick<
    ProductFormState,
    'preorderEnabled' | 'preorderCampaignId' | 'preorderOwn' | 'preorderLimit'
  >,
): VariantPreorderContext {
  return {
    on: form.preorderEnabled || Boolean(form.preorderCampaignId),
    inherited: inheritedPreorderLimit(form),
  }
}
