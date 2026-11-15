/** Copy for one parcel carrying several orders: the AWB clash message and "Same box as #A". */
export const sharedParcelContent = {
  /** A tracking number typed for this order is already on another order's shipment. */
  awbOnOther: (waybill: string, number: number, live: boolean) =>
    live
      ? `Tracking number ${waybill} is already on order #${number}. To send this order in the same box, choose "Same box as #${number}" when you fulfil it.`
      : `Tracking number ${waybill} was used on order #${number}. Use a new tracking number for this order.`,
  /** Fulfil items: how the picked items go out. */
  label: 'Parcel',
  ownParcel: 'Its own parcel',
  sameBox: (number: number, courier: string, waybill: string) =>
    `Same box as #${number} (${courier}, AWB ${waybill})`,
  hint: 'Packed in the same box as another order from this customer? Pick it: no second booking, and this order follows that parcel’s tracking.',
  /** The order page's shipment card. */
  inSameBox: (number: number) => `In the same box as order #${number}`,
  inSameBoxHint: 'Cancel, pickups and tracking edits are on that order.',
  alsoCarries: 'Also carries',
  orderLink: (number: number) => `#${number}`,
}
