import type { StoreContext } from '../context'

export type Address = {
  name: string
  line1: string
  line2?: string
  city: string
  state: string
  pincode: string
  phone: string
}

export interface FulfilmentProvider {
  readonly id: string
  isServiceable(
    ctx: StoreContext,
    pincode: string,
  ): Promise<{ serviceable: boolean; etaDays?: number }>
  createShipment(
    ctx: StoreContext,
    input: { orderId: string; address: Address },
  ): Promise<{ awb: string }>
}
