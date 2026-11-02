/** Copy for suppliers, inbound shipments, purchase charges and landed cost (Products). */
import type {
  CostWarning,
  InboundShipmentStatus,
  PurchaseChargeKind,
  SplitMethod,
} from '@commerce/core/inventory'

export {
  INBOUND_SHIPMENT_STATUSES,
  type InboundShipmentStatus,
  PURCHASE_CHARGE_KINDS,
  PURCHASE_CURRENCY_CODES,
  SPLIT_METHODS,
} from '@commerce/core/inventory'

export const suppliersContent = {
  heading: 'Suppliers',
  summary: 'Who you buy stock from',
  resource: { singular: 'supplier', plural: 'suppliers' },
  create: 'Add supplier',
  columns: {
    name: 'Supplier',
    country: 'Country',
    currency: 'Bills in',
    gstin: 'GSTIN',
    terms: 'Payment terms',
    orders: 'Purchase orders',
  },
  none: 'None',
  filters: {
    country: 'Country',
    currency: 'Bills in',
    gstin: 'Has a GSTIN',
    orders: 'Has purchase orders',
  },
  noResults: {
    heading: 'No suppliers match these filters',
    body: 'Try a different search or clear the filters.',
  },
  empty: {
    heading: 'No suppliers yet',
    body: 'Save the people you buy stock from once, then pick them on every purchase order.',
  },
} as const

export const supplierFormContent = {
  newTitle: 'Add supplier',
  back: 'Suppliers',
  billsIn: (currency: string) => `bills in ${currency}`,
  orderCount: (n: number) => `${n} purchase ${n === 1 ? 'order' : 'orders'}`,
  details: {
    heading: 'Supplier',
    name: 'Name',
    gstin: 'GSTIN',
    gstinHint: 'Only for suppliers registered in India',
    country: 'Country code',
    currency: 'Bills in',
  },
  contact: { heading: 'Contact', email: 'Email', phone: 'Phone', address: 'Address' },
  terms: {
    heading: 'Terms and notes',
    paymentTerms: 'Payment terms',
    paymentTermsPlaceholder: '30% advance, the rest before dispatch',
    notes: 'Notes',
  },
  orders: {
    heading: 'Purchase orders',
    empty: 'No purchase orders from this supplier yet.',
    number: (n: number) => `#PO${n}`,
  },
  save: 'Save',
  saving: 'Saving',
  saved: 'Supplier saved',
  created: 'Supplier added',
  failed: 'Could not save supplier',
  needName: 'Add the supplier name',
  /** Why a GSTIN was refused, by `validateGstin` reason (same rules as checkout). */
  gstinErrors: {
    shape: 'A GSTIN has 15 characters, like 06AAACW1234A1Z5',
    state: 'The first two digits are not a GST state code',
    checksum: 'This GSTIN has a typo: its last character does not match the rest',
  },
  delete: 'Delete',
  deleted: 'Supplier deleted',
  deleteFailed: 'Could not delete the supplier',
  unsaved: 'Unsaved supplier',
  discard: 'Discard',
  confirmDelete: {
    title: 'Delete this supplier?',
    body: 'Purchase orders keep the supplier name; they just stop pointing at this record.',
    confirm: 'Delete supplier',
    cancel: 'Cancel',
  },
} as const

export const supplierPickerContent = {
  search: 'Search saved suppliers',
  new: 'New supplier',
  linked: 'Saved supplier',
  change: 'Change',
  newTitle: 'New supplier',
  newBody: 'Saved for next time. You can add the rest of the details under Suppliers.',
  create: 'Add supplier',
  creating: 'Adding',
  cancel: 'Cancel',
  failed: 'Could not add supplier',
  /** A name typed on the purchase order, offered to Suppliers (audit #157). */
  saveTyped: 'Save as supplier',
  saveTypedHelp: 'Not in your suppliers yet.',
} as const

export const poCurrencyContent = {
  heading: 'Currency',
  currency: 'Supplier bills in',
  fxRate: 'Exchange rate',
  fxHint: (code: string) =>
    `Rupees for 1 ${code}. Use the rate on your Bill of Entry or bank advice.`,
  locked: 'The currency is fixed once the order is sent.',
  badRate: 'Enter an exchange rate above 0',
  badPrice: 'Check the unit prices: too many decimals for this currency',
} as const

export const poShipmentContent = {
  heading: 'Inbound shipment',
  none: 'Not on a shipment. Add it from an inbound shipment to share its freight and customs.',
  on: (n: number, reference: string | null) => (reference ? `#IS${n} · ${reference}` : `#IS${n}`),
  open: 'Open shipment',
} as const

export const inboundShipmentsContent = {
  heading: 'Inbound shipments',
  summary: 'Imports on their way: one Bill of Entry or container, with its freight and customs',
  resource: { singular: 'inbound shipment', plural: 'inbound shipments' },
  create: 'Create inbound shipment',
  number: (n: number) => `#IS${n}`,
  status: {
    in_transit: 'On the way',
    at_port: 'At the port',
    cleared: 'Customs cleared',
    delivered: 'Delivered',
  } satisfies Record<InboundShipmentStatus, string>,
  tabs: { all: 'All' },
  columns: {
    number: 'Shipment',
    reference: 'Reference',
    billOfEntry: 'Bill of Entry',
    port: 'Port',
    status: 'Status',
    orders: 'Orders',
    arrived: 'Arrived',
  },
  none: 'None',
  filters: {
    status: 'Status',
    expected: 'Expected',
    arrived: 'Arrived',
    billOfEntry: 'Has a Bill of Entry',
  },
  noResults: {
    heading: 'No inbound shipments match these filters',
    body: 'Try a different search or clear the filters.',
  },
  empty: {
    heading: 'No inbound shipments',
    body: 'An inbound shipment groups the purchase orders that came in one container or Bill of Entry, so their freight and customs split across all of them.',
  },
} as const

export const inboundShipmentFormContent = {
  newTitle: 'Create inbound shipment',
  title: (n: number) => `Inbound shipment #IS${n}`,
  back: 'Inbound shipments',
  billOfEntry: (no: string) => `Bill of Entry ${no}`,
  glance: {
    heading: 'At a glance',
    orders: 'Purchase orders',
    units: 'Units arriving',
    charges: 'Charges in cost',
    landed: 'Landed total',
  },
  details: {
    heading: 'Shipment',
    reference: 'Your reference',
    referencePlaceholder: 'Container, AWB or forwarder job number',
    billOfEntryNo: 'Bill of Entry number',
    billOfEntryDate: 'Bill of Entry date',
    port: 'Port',
    portPlaceholder: 'Nhava Sheva, Chennai, Delhi Air Cargo',
    arrivedAt: 'Arrived on',
    status: 'Status',
  },
  tracking: {
    heading: 'Tracking',
    carrier: 'Carrier',
    noCarrier: 'Not set',
    other: 'Other',
    number: 'Tracking number',
    url: 'Tracking link',
    urlPlaceholder: 'Filled from the carrier and number, or paste one',
    open: 'Open tracking',
    expected: 'Expected arrival',
    check: 'Check tracking',
    checking: 'Checking',
    readAt: (when: string) => `Read from the carrier's tracking, ${when}`,
    liveHint: 'Filled from the carrier when you save, if its app is connected.',
    manualHint: 'Type the date the carrier or forwarder gave you.',
    updated: (date: string) => `Expected arrival: ${date}`,
    noDate: 'The carrier has no delivery date for this yet',
    notConnected: (carrier: string) =>
      `Connect ${carrier} under Settings → Shipping to read its delivery date`,
    failed: 'Could not read the tracking. Check the number and try again.',
  },
  orders: {
    heading: 'Purchase orders',
    search: 'Search purchase orders to add',
    empty:
      'Add the purchase orders that came in this shipment. Its charges split across all their products.',
    remove: 'Remove from shipment',
    units: (n: number) => `${n} ${n === 1 ? 'unit' : 'units'}`,
    number: (n: number) => `#PO${n}`,
    added: 'Purchase order added. Costs updated.',
    removed: 'Purchase order removed. Costs updated.',
    elsewhere: 'On another shipment',
  },
  notes: { heading: 'Notes', placeholder: 'Forwarder, vessel or anything else' },
  saveFirst: 'Save the shipment first, then add its orders and charges.',
  save: 'Save',
  saving: 'Saving',
  saved: 'Shipment saved',
  created: 'Shipment created',
  failed: 'Could not save shipment',
  delete: 'Delete',
  deleted: 'Shipment deleted',
  deleteFailed: 'Could not delete the shipment',
  unsaved: 'Unsaved shipment',
  discard: 'Discard',
  confirmDelete: {
    title: 'Delete this shipment?',
    body: 'Its shared charges are deleted too.',
    blocked: 'This shipment still has purchase orders. Remove them first, then delete it.',
    confirm: 'Delete shipment',
    cancel: 'Cancel',
  },
  /** "Mark as delivered" (#1065): receives what is outstanding on its purchase orders. */
  deliver: {
    action: 'Mark as delivered',
    title: 'Mark this shipment delivered?',
    loading: 'Checking what is still to come in…',
    body: (units: number, orders: number) =>
      `${units} ${units === 1 ? 'unit' : 'units'} from ${orders} purchase ${
        orders === 1 ? 'order' : 'orders'
      } go into stock at each order's location, and the shipment is marked delivered.`,
    nothing: 'Everything on its purchase orders is already in. The shipment is marked delivered.',
    shortHint:
      'Some units missing or damaged? Receive that order on its own page first, with rejected units; this takes in the rest.',
    order: (n: number, units: number) => `#PO${n}: ${units} ${units === 1 ? 'unit' : 'units'}`,
    confirm: 'Receive and mark delivered',
    cancel: 'Cancel',
    done: (units: number) =>
      `Shipment delivered: ${units} ${units === 1 ? 'unit' : 'units'} received`,
    failed: 'Could not mark the shipment delivered',
  },
} as const

export const chargesContent = {
  heading: 'Charges',
  shipmentHeading: 'Shared charges',
  summary: 'Freight, customs duty, clearing and bank charges become part of each product’s cost.',
  empty: 'No charges yet.',
  saveFirst: 'Save first, then add charges.',
  add: 'Add charge',
  edit: 'Edit',
  remove: 'Remove',
  fromShipment: (n: number) => `Shared, from shipment #IS${n}`,
  kinds: {
    goods_adjustment: 'Goods adjustment',
    freight_insurance: 'Freight and insurance',
    customs_bcd: 'Basic customs duty (BCD)',
    customs_sws: 'Social welfare surcharge (SWS)',
    customs_igst: 'IGST paid at customs',
    cha_fee: 'Clearing agent (CHA) fee',
    port_handling: 'Port and handling',
    freight_local: 'Local freight',
    bank_fx: 'Bank and exchange charges',
    other: 'Other',
  } satisfies Record<PurchaseChargeKind, string>,
  methods: {
    by_weight: 'By weight',
    by_value: 'By value',
    by_quantity: 'By quantity',
    specific_lines: 'Only some products',
    manual: 'Amount per product',
  } satisfies Record<SplitMethod, string>,
  inCost: 'In product cost',
  notInCost: 'Input credit, not in cost',
  gst: (amount: string) => `+ ${amount} GST`,
  dialog: {
    addTitle: 'Add charge',
    editTitle: 'Edit charge',
    kind: 'What is it for',
    amount: 'Amount, before GST',
    amountHint: 'A goods adjustment can be negative, for a supplier credit.',
    currency: 'Currency',
    fxRate: 'Exchange rate',
    fxHint: (code: string) => `Rupees for 1 ${code}`,
    gst: 'GST on this bill (₹)',
    gstHint: 'You claim this back as input credit, so it is never part of product cost.',
    recoverable: 'Claim back as input credit',
    recoverableHint:
      'On for IGST paid at customs. The amount is tracked but left out of product cost.',
    split: 'Split across products',
    lines: 'Products',
    manualLeft: (amount: string) => `${amount} left to assign`,
    manualDone: 'Every rupee is assigned',
    payee: 'Paid to',
    payeePlaceholder: 'Shipping line, CHA or bank',
    note: 'Note',
    incurredAt: 'Bill date',
    save: 'Save charge',
    saving: 'Saving',
    cancel: 'Cancel',
    needAmount: 'Enter the amount',
    badRate: 'Enter an exchange rate above 0',
    needLines: 'Pick at least one product',
    manualOff: 'The amounts per product must add up to the charge',
  },
  added: 'Charge added. Costs updated.',
  saved: 'Charge saved. Costs updated.',
  removed: 'Charge removed. Costs updated.',
  failed: 'Could not save the charge',
  confirmRemove: {
    title: 'Remove this charge?',
    body: 'Product costs are worked out again without it. Stock already received is revalued.',
    confirm: 'Remove charge',
    cancel: 'Cancel',
  },
  warnings: {
    missing_weight: (n: number) =>
      `Split by value instead: ${n} ${n === 1 ? 'product has' : 'products have'} no weight. Add weights to the products to split by weight.`,
    manual_mismatch: 'Split by value instead: the amounts per product do not add up to the charge.',
    no_selected_lines: 'Split by value instead: the products picked are no longer on the order.',
    zero_basis: 'Split by quantity instead: every product here is worth nothing or weighs nothing.',
    no_lines: 'Not in any cost yet: add a purchase order to this shipment.',
  },
} as const

/** The warning text for one fallback. */
export function warningText(copy: typeof chargesContent, w: CostWarning): string {
  if (w.code === 'missing_weight') return copy.warnings.missing_weight(w.lineIds.length)
  return copy.warnings[w.code]
}

export const landedCostContent = {
  heading: 'Landed cost',
  summary:
    'What each unit really costs once freight, duty and clearing are added. GST you claim back is left out.',
  columns: {
    product: 'Product',
    quantity: 'Qty',
    goods: 'Goods',
    charges: 'Charges',
    landed: 'Per unit',
    current: 'Cost now',
  },
  order: (n: number) => `#PO${n}`,
  totals: {
    goods: 'Goods',
    charges: 'Charges in cost',
    recoverable: 'IGST and other input credit',
    gst: 'GST on bills',
    landed: 'Landed total',
  },
  notSet: 'Not set',
  empty: 'Add products to see what they land at.',
} as const
