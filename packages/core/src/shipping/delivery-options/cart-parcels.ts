/** SOURCE OF TRUTH: the parcels checkout prices a cart as — WHAT: `cartDeliveryParcels` splits a
 * cart the way the order will be split (`previewCartParcels`, the same routing `placeOrder`
 * uses), and gives each parcel its lines, its share of the order value, where the courier
 * collects it and its box and billed weight (`cartParcelFor`) / WHY: a cart shipping from two
 * warehouses is two labels; checkout prices each (#1546). One parcel or none: an empty list, and
 * checkout prices the cart whole from Settings › Shipping's PIN code exactly as before.
 */
import { cartLine, location, type StoreTx } from '@commerce/db'
import { eq, inArray } from 'drizzle-orm'
import { previewCartParcels } from '../../order/parcel-view'
import type { CartParcel } from '../parcel'
import type { ShippingSettings } from '../settings'
import { pickupPincodeOf } from '../ship-from'
import { shareValue } from './parcels'
import { cartParcelFor } from './service'

export type CartDeliveryParcel = {
  /** `locationId:status`: a pre-order parcel at the same place is its own parcel. */
  key: string
  originPincode: string
  lines: Array<{ variantId: string; quantity: number }>
  /** Its share of the order value (after discounts), by its goods' prices. */
  valuePaise: number
  parcel: CartParcel
}

/**
 * The cart's parcels when it ships as more than one, else `[]` (price it whole, as before).
 * `storePincode` is Settings › Shipping's origin, for a location without courier pickup.
 */
export async function cartDeliveryParcels(
  tx: StoreTx,
  storeId: string,
  cartId: string,
  input: {
    buyerState: string
    valuePaise: number
    storePincode: string
    boxPresets: ShippingSettings['boxPresets']
  },
): Promise<CartDeliveryParcel[]> {
  const previews = await previewCartParcels({ storeId, tx }, cartId, input.buyerState)
  if (previews.length <= 1) return []
  const [places, prices] = await Promise.all([
    tx
      .select()
      .from(location)
      .where(
        inArray(
          location.id,
          previews.map((p) => p.locationId),
        ),
      ),
    tx
      .select({ variantId: cartLine.variantId, unitPricePaise: cartLine.unitPricePaise })
      .from(cartLine)
      .where(eq(cartLine.cartId, cartId)),
  ])
  const unit = new Map(prices.map((p) => [p.variantId, p.unitPricePaise]))
  const values = shareValue(
    input.valuePaise,
    previews.map((p) => p.lines.reduce((s, l) => s + (unit.get(l.variantId) ?? 0) * l.quantity, 0)),
  )
  return Promise.all(
    previews.map(async (p, i) => {
      const lines = p.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity }))
      const at = places.find((l) => l.id === p.locationId)
      return {
        key: `${p.locationId}:${p.status}`,
        originPincode: at ? pickupPincodeOf(at, input.storePincode) : input.storePincode,
        lines,
        valuePaise: values[i] ?? 0,
        parcel: await cartParcelFor(tx, lines, input.boxPresets),
      }
    }),
  )
}
