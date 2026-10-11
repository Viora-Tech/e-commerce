/** The order page's "Ships from" card: one parcel per warehouse. */
export const parcelsCardContent = {
  title: (count: number) => (count === 1 ? 'Ships from' : `Ships in ${count} parcels`),
  parcel: (position: number) => `Parcel ${position}`,
  from: (place: string) => `From ${place}`,
  billedUnder: (gstin: string) => `GST ${gstin}`,
  units: (count: number) => (count === 1 ? '1 item' : `${count} items`),
  status: {
    open: 'To pack',
    on_hold: 'On hold (pre-order)',
    fulfilled: 'Packed',
    cancelled: 'Cancelled',
  },
  needsTransfer: 'Needs stock moved',
  needsTransferHelp:
    'This location did not have all of it when the order was placed. Move the stock here before packing.',
  packed: (done: number, of: number) => `${done} of ${of} packed`,
}

/** The order page's Profit card (order/profit.ts in core). */
export const profitCardContent = {
  title: 'Profit',
  netSales: 'Net sales (without GST)',
  goods: 'Cost of goods',
  courier: 'Courier charges',
  fees: 'Payment fees',
  rto: 'RTO costs',
  profit: 'Profit',
  margin: (percent: string) => `${percent} margin`,
  notes: {
    costEstimated: 'Some item costs were filled in after the sale from the cost at that time.',
    costMissing: 'Some items have no cost yet, so they count as free. Add the cost on the product.',
    courierMissing: 'The courier charge is not known yet. Add it below.',
    feeFromRate: 'Payment fees use your rates in Settings › Costs for profit.',
    feeMissing: 'No fee rate is set for this payment method.',
  },
  setRates: 'Set fee rates',
  courierLabel: 'Courier charge (₹)',
  courierSave: 'Save',
  courierSaved: 'Courier charge saved',
  courierInvalid: 'Type an amount in rupees, like 65 or 65.50.',
  failed: 'Could not save',
}
