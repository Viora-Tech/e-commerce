/** Checkout copy for the Delivery options app: courier-backed cards, insurance and COD notes. */
export const deliveryOptionsContent = {
  /** Under a card whose route has no courier ETA. */
  usually: (min: number, max: number) =>
    min === max ? `Usually ${min} days` : `Usually ${min}–${max} days`,
  /** Under an option that refuses cash on delivery (Express). */
  prepaidOnly: 'Cash on delivery not available with this option',
  /** The insurance checkbox under the options. */
  insure: (price: string | null) =>
    price ? `Insure this shipment (+${price})` : 'Insure this shipment',
  /** The Payment step, when cash on delivery ships another route at another price. */
  codRoute: (extra: string, carrier: string) =>
    `Cash on delivery: +${extra}, ships with ${carrier}`,
  /** The Payment step, when the picked delivery option is prepaid only. */
  codPrepaidOnly: (option: string) => `Not available with ${option} delivery`,
  /** Pay refused: cash on delivery with a prepaid-only option. */
  codPrepaidOnlyOption:
    'The delivery option you picked is prepaid only. Pay online, or pick Standard delivery to pay on delivery.',
} as const
