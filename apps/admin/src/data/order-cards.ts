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
  packing: 'Packing',
  courier: 'Delivery',
  fees: 'Payment fees',
  rto: 'RTO costs',
  profit: 'Profit',
  margin: (percent: string) => `${percent} margin`,
  notes: {
    costEstimated: 'Some item costs were filled in after the sale from the cost at that time.',
    costMissing: 'Some items have no cost yet, so they count as free. Add the cost on the product.',
    courierMissing: 'The courier charge is not known yet. Add it below.',
    courierEstimated:
      'Delivery is estimated (your highest charge to this state in 60 days, else your default) until the courier charge is known. Add it below when you have it.',
    packingEstimated: 'Packing is your box cost today; it is fixed when the parcel is booked.',
    packingMissing:
      'Your box has no cost set, so packing counts as nothing. Add it in Settings › Shipping.',
    feeFromRate:
      'Payment fees are estimated from your rates in Settings › Costs for profit until Razorpay or Cashfree reports the actual fee.',
    feeMissing: 'No fee rate is set for this payment method.',
  },
  feeSource: {
    actual: 'Actual',
    estimated: 'Estimated',
    mixed: 'Partly estimated',
  },
  feeSourceHelp: {
    actual: 'The fee Razorpay or Cashfree reported for this payment.',
    estimated: 'From your rates, until the gateway reports the actual fee.',
    mixed: 'Some fees are actual, the rest from your rates until the gateway reports them.',
  },
  setRates: 'Set fee rates',
  estimatedTag: 'Estimated',
  estimatedDetail: 'estimated',
  atLeast: (amount: string) => `at least ${amount}`,
  floor:
    'Based on the costs you entered. Your real profit may be higher or lower if some costs differ.',
  courierLabel: 'Courier charge (₹)',
  courierSave: 'Save',
  courierSaved: 'Courier charge saved',
  courierInvalid: 'Type an amount in rupees, like 65 or 65.50.',
  failed: 'Could not save',
}

/** The order page's Delivery option card: the route chosen at checkout, backup, shipping margin. */
export const deliveryRouteCardContent = {
  title: 'Delivery option',
  via: (service: string, app: string) => `${service} via ${app}`,
  insured: 'Insured',
  promised: (range: string) => `Promised ${range}`,
  backupTag: 'Placed on backup',
  backupHelp:
    'Couriers did not answer at checkout, so this order was charged your zone rate and saved no route. Book it with your courier rules; product route rules still apply.',
  charged: 'Shipping charged',
  courier: 'Courier',
  courierFrom: {
    booking: 'from the booking',
    quote: 'quoted at checkout',
  },
  insurance: 'Insurance',
  margin: 'Shipping margin',
  marginUnknown: 'The margin shows once the parcel is booked and its courier charge is known.',
}
