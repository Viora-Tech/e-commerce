/** Checkout copy for the Delivery options app: courier-backed cards, insurance and COD notes. */
export const deliveryOptionsContent = {
  /** Under a card whose route has no courier ETA. */
  usually: (min: number, max: number) =>
    min === max ? `Usually ${min} days` : `Usually ${min}–${max} days`,
  /** Under an option that refuses cash on delivery (Express). */
  prepaidOnly: 'Pay online for this option',
  /** The fact line under a card (Figma 942:513): how it travels, joined with " · ". */
  mode: { air: 'By air', express: 'Express', surface: 'Surface' },
  /** Before today's dispatch cut-off: "order in the next 2 h 14 min". */
  orderWithin: (hours: number, minutes: number) =>
    `Order in the next ${[hours > 0 ? `${hours} h` : '', minutes > 0 ? `${minutes} min` : ''].filter(Boolean).join(' ')}`,
  codAvailable: 'Cash on delivery available',
  /** The summary's delivery row while the parcel is insured (Figma 945:519). */
  insured: 'insured',
  /** The insurance checkbox under the options. */
  insure: (price: string | null) =>
    price ? `Insure this shipment (+${price})` : 'Insure this shipment',
  insureTitle: 'Insure this parcel',
  insureBody: 'Replaced or refunded if it’s lost or damaged on the way.',
  /** The Payment step, when cash on delivery ships another route at another price. */
  codRoute: (extra: string, carrier: string) =>
    `Cash on delivery: +${extra}, ships with ${carrier}`,
  /** The Payment step, when the picked delivery option is prepaid only. */
  codPrepaidOnly: (option: string) => `Not available with ${option} delivery`,
  /** Pay refused: cash on delivery with a prepaid-only option. */
  codPrepaidOnlyOption:
    'The delivery option you picked is prepaid only. Pay online, or pick Standard delivery to pay on delivery.',
} as const
