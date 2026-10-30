/** SOURCE OF TRUTH: previewCartGst — WHAT: the GST contained in what a shopper is about to pay for a cart, worked out the way placing the order does (each line's rate, gift cards and untaxed lines at 0, composition stores at 0, the discount spread over the lines) / WHY: checkout's summary says "Includes ₹X GST" before the order exists; the invoice stays the authority (a multi-warehouse order may bill parcels from different GSTINs, which moves CGST/SGST vs IGST but not the total) */
import { cart, cartLine, product, type StoreTx, store, variant } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { effectiveGstRatePercent } from '../catalog/effective-tax'
import { StoreAddressSchema } from '../settings/general'
import { computeOrderGst } from './gst'
import { chargedGstRate, parseStoreTax } from './settings'

export type CartGstPreview = {
  taxPaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
}

const NONE: CartGstPreview = { taxPaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0 }

/**
 * GST inside `totalPaise` (what is charged: goods after discount, plus shipping and any payment
 * fee). `reductionPaise` is the discount and any payment-method discount, spread over the
 * lines as place-order does. Null `shipToState` (no address yet) still gives the total; only
 * the CGST/SGST vs IGST split needs the state.
 */
export async function previewCartGst(
  tx: StoreTx,
  storeId: string,
  input: {
    cartId: string
    totalPaise: number
    reductionPaise: number
    shipToState: string | null
  },
): Promise<CartGstPreview> {
  const [c] = await tx.select({ status: cart.status }).from(cart).where(eq(cart.id, input.cartId))
  if (c?.status !== 'open') return NONE
  const [s] = await tx
    .select({ address: store.address, gstRatePercent: store.gstRatePercent, apps: store.apps })
    .from(store)
    .where(eq(store.id, storeId))
  if (!s) return NONE
  const storeTax = parseStoreTax(s.apps)
  const rows = await tx
    .select({
      quantity: cartLine.quantity,
      unitPricePaise: cartLine.unitPricePaise,
      gstRatePercent: effectiveGstRatePercent,
      taxable: variant.taxable,
      giftCard: product.isGiftCard,
    })
    .from(cartLine)
    .innerJoin(variant, eq(variant.id, cartLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(eq(cartLine.cartId, input.cartId))
  if (rows.length === 0) return NONE
  const storeAddress = StoreAddressSchema.safeParse(s.address ?? {})
  const gst = computeOrderGst({
    lines: rows.map((r) => ({
      grossPaise: r.quantity * r.unitPricePaise,
      ratePercent:
        r.giftCard || !r.taxable
          ? 0
          : chargedGstRate(r.gstRatePercent ?? s.gstRatePercent, storeTax),
    })),
    totalPaise: Math.max(0, input.totalPaise),
    reductionPaise: Math.max(0, input.reductionPaise),
    shipToState: input.shipToState,
    storeState: storeAddress.success ? storeAddress.data.state : null,
  })
  return {
    taxPaise: gst.taxPaise,
    cgstPaise: gst.cgstPaise,
    sgstPaise: gst.sgstPaise,
    igstPaise: gst.igstPaise,
  }
}
