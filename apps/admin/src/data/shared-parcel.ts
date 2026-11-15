/** Copy for one parcel carrying several orders: the AWB clash message and "Same box as #A". */
export const sharedParcelContent = {
  /** A tracking number typed for this order is already on another order's shipment. */
  awbOnOther: (waybill: string, number: number, live: boolean) =>
    live
      ? `Tracking number ${waybill} is already on order #${number}. To send this order in the same box, choose "Same box as #${number}" when you fulfil it.`
      : `Tracking number ${waybill} was used on order #${number}. Use a new tracking number for this order.`,
}
