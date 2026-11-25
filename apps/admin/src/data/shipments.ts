import { siteConfig } from '@commerce/config/site'
/** Copy for the Shipments workspace (Orders → Shipments). */
export const shipmentsContent = {
  title: 'Shipments',
  resource: { singular: 'shipment', plural: 'shipments' },
  /** The line under the title, per tab (Figma "Orders / Shipments"). */
  summary: {
    toBook: (ready: number, today: number) =>
      `${ready} ${ready === 1 ? 'order' : 'orders'} ready to ship · ${today} booked today`,
    lowWallet: (ready: number) =>
      `${ready} ${ready === 1 ? 'order' : 'orders'} ready to ship · wallet low`,
    booked: (n: number) => `${n} booked, no pickup yet`,
    toPickUp: (n: number) =>
      `${n} ${n === 1 ? 'parcel' : 'parcels'} on a pickup, waiting for the courier`,
    inTransit: (n: number) => `${n} ${n === 1 ? 'shipment' : 'shipments'} on the way`,
    delivered: (n: number) => `${n} delivered`,
    rto: (n: number) => `${n} returned to you (RTO)`,
    lost: (n: number) => `${n} lost by the courier`,
    needsAttention: (n: number) => `${n} need${n === 1 ? 's' : ''} attention`,
    noCourier: 'Connect a courier to start booking',
  },
  viewLabel: 'Shipment view',
  tabs: {
    toBook: 'To ship',
    booked: 'Booked',
    toPickUp: 'To be picked up',
    inTransit: 'In transit',
    delivered: 'Delivered',
    rto: 'Returned (RTO)',
    lost: 'Lost',
  },
  search: 'Search orders',
  columns: {
    order: 'Order',
    shipTo: 'Ship to',
    courier: 'Courier',
    weight: 'Weight',
    status: 'Status',
  },
  toBookChip: 'To ship',
  deliveryFailed: 'Delivery failed',
  pickedAtBooking: 'Picked when booking',
  kg: (grams: number) => `${(grams / 1000).toFixed(1)} kg`,
  noWeight: '—',
  guest: 'Guest',
  courierSettings: 'Courier settings',
  pickupsButton: 'Pickups',
  bookSelected: 'Book selected',
  shipNow: 'Ship now',
  bookSelectedHint: 'Select orders in To ship first',
  printLabels: 'Print labels',
  menu: {
    viewOrder: 'View order',
    label: 'Print label',
    track: 'Track parcel',
  },
  empty: {
    toBook: 'Nothing to ship. Paid orders waiting on a label show up here.',
    booked:
      'No labels without a pickup. Select booked labels and Create pickup to hand them to the courier.',
    toPickUp: 'Nothing waiting for the courier. Labels you create a pickup for show up here.',
    inTransit: 'Nothing on the way right now.',
    delivered: 'No deliveries yet.',
    rto: 'No parcels have come back.',
    lost: 'No lost parcels. A parcel the courier loses shows up here to reship and claim.',
  },
  noCourier: {
    heading: 'Connect a courier',
    body: `Book pickups, print labels and track parcels without leaving ${siteConfig.brand.name}. Delhivery, Shiprocket, RapidShyp, Blue Dart, DTDC, India Post, Xpressbees, Ekart and Shadowfax are ready.`,
    browse: 'Browse courier apps',
  },
  wallet: {
    heading: (courier: string, balance: string) => `${courier} wallet · ${balance}`,
    ok: (threshold: string) => `Low-balance alert below ${threshold}.`,
    low: (threshold: string) => `Below your ${threshold} alert. Recharge before booking more.`,
    recharge: 'Recharge',
    rechargeUrl: {
      delhivery: 'https://one.delhivery.com/',
      shiprocket: 'https://app.shiprocket.in/seller/wallet',
    } as Record<string, string>,
  },
  pickupsSheet: {
    title: 'Pickups and manifests',
    body: 'Book the courier pickup for booked parcels and print the manifest.',
  },
  byNumberSheet: {
    title: 'Book by order number',
    body: 'For orders To book does not list, such as cash on delivery orders.',
  },
  more: 'More shipment actions',
  ndrSheet: {
    title: 'Deliveries that need you',
    body: 'The courier could not deliver these. Choose what happens next.',
  },
  book: {
    heading: 'Book by order number',
    help: 'Paste one order number per line (or comma-separated). Use this for cash on delivery orders, which To book does not list until they are paid.',
    placeholder: '1042, 1043, 1044',
    submit: 'Create shipments',
    finding: 'Finding orders…',
    noOrders: 'Enter at least one order number',
    someMissing: (n: number) =>
      `${n} ${n === 1 ? 'number did' : 'numbers did'} not match an order and ${n === 1 ? 'was' : 'were'} left out.`,
  },
  pickups: {
    heading: 'Schedule a pickup',
    help: 'Tick the booked parcels the courier should collect, then pick a day and time.',
    date: 'Pickup date',
    timeFrom: 'From (24h, e.g. 14:00)',
    timeTo: 'To (optional)',
    submit: 'Schedule pickup',
    scheduling: 'Scheduling…',
    listHeading: 'Recent pickups',
    manifestsHeading: 'Manifests',
    manifestHelp:
      'A manifest groups a pickup into one printable label sheet. Delhivery has no separate manifest API yet, so this is generated from your saved labels.',
    createManifestFor: 'Create manifest for this pickup',
    columns: {
      date: 'Date',
      window: 'Window',
      packages: 'Packages',
      status: 'Status',
      reference: 'Reference',
    },
    empty: 'No pickups booked yet.',
    manifestsEmpty: 'No manifests yet.',
    manifestColumns: { courier: 'Courier', shipments: 'Shipments' },
    manifestShipments: (n: number) => (n === 1 ? '1 shipment' : `${n} shipments`),
  },
  ndr: {
    heading: 'Delivery problems (NDR)',
    help: 'The courier could not deliver these. Choose what to do next for each one.',
    empty: 'Nothing waiting on you right now.',
    columns: {
      order: 'Order',
      waybill: 'Waybill',
      reason: 'Courier said',
      raised: 'Raised',
      actions: 'Actions',
    },
    actions: {
      reattempt: 'Try delivery again',
      change_address: 'Use a new address',
      rto: 'Send it back (RTO)',
    },
    changeAddressName: 'New name',
    changeAddressPhone: 'New phone',
    changeAddressAddress: 'New address',
    apply: 'Send to courier',
    applied: 'Sent to the courier',
  },
}

/** Row and bulk actions on the Shipments table: pickups, manifests, tracking, cancel. */
export const shipmentActionsContent = {
  schedulePickup: 'Create pickup',
  pickupTitle: (n: number) => `Create a pickup for ${n} ${n === 1 ? 'parcel' : 'parcels'}`,
  pickupBody:
    'The courier is asked to collect these parcels on the day and time you pick, a manifest is made to hand over, and they move to To be picked up.',
  pickupAndManifestDone: (n: number) =>
    `Pickup requested for ${n} ${n === 1 ? 'parcel' : 'parcels'}. Its manifest is in Pickups.`,
  date: 'Pickup date',
  timeFrom: 'From (24h, e.g. 14:00)',
  timeTo: 'To (optional)',
  /** A pickup already booked that these parcels can join (one request per place and day). */
  joinPickup: (courier: string, when: string, n: number) =>
    `Add to ${courier} pickup · ${when} · ${n} ${n === 1 ? 'parcel' : 'parcels'} in it`,
  newPickup: 'New pickup',
  addToPickup: 'Add to pickup',
  joinedDone: (n: number) =>
    `Added ${n} ${n === 1 ? 'parcel' : 'parcels'} to the pickup. Its manifest is in Pickups.`,
  pickupDone: (n: number) => `Pickup scheduled for ${n} ${n === 1 ? 'parcel' : 'parcels'}`,
  /** To be picked up's selection bar: the ticked parcels leave their pickup (owner, 22 Nov 2026). */
  cancelPickup: 'Cancel pickup',
  cancelPickupTitle: (n: number) => `Take ${n} ${n === 1 ? 'parcel' : 'parcels'} off the pickup?`,
  cancelPickupBody:
    'The labels stay live and the parcels go back to Booked, off their pickup and manifest. Delhivery books a pickup for your warehouse, not for each parcel: its executive may still collect them. Cancel the shipment if a parcel must not go.',
  cancelPickupDone: (n: number) => `${n} ${n === 1 ? 'parcel is' : 'parcels are'} back in Booked.`,
  cancelPickupSome: (done: number, failed: number) =>
    `${done} back in Booked; ${failed} could not leave the pickup (already collected?).`,
  /** Ticked parcels left out of Create pickup or Cancel pickup: their courier set its own pickup. */
  pickupByCourierSkipped: (n: number, courier: string) =>
    `${n} ${n === 1 ? 'parcel is' : 'parcels are'} left out: ${courier} schedules its own pickup when you book. To stop the pickup, cancel the shipment.`,
  refreshTracking: 'Refresh tracking',
  trackingUpdated: 'Tracking updated',
  failed: 'The courier request did not go through. Try again in a moment.',
  /** A pickup request the courier refused without saying why (its words are shown when it does). */
  pickupRefused:
    "The courier didn't take the pickup request. Try again, or book it on their dashboard.",
  /** Under a refused pickup: what happened to the parcels and what to do next. */
  pickupStaysBooked: 'The parcels stay in Booked. Fix the problem, then try Create pickup again.',
}

/** The ⋯ → Cancel popup on a booked parcel (owner, 18 Nov 2026): the ways out depend on where it is. */
export const shipmentCancelContent = {
  menu: 'Cancel…',
  title: (awb: string) => `What should happen to AWB ${awb}?`,
  back: 'Cancel pickup',
  backHelp:
    'The label stays live. The parcel comes off this pickup and its manifest and goes back to Booked, so you can put it on another day’s pickup.',
  shipment: 'Cancel shipment',
  shipmentHelp:
    'The courier cancels this AWB. The items stay packed and the order goes back to To ship, to book again with any courier.',
  sendBack: 'Cancel and bring it back',
  sendBackHelp:
    'The courier already has it. They are asked to cancel, which sends the parcel back to you. It moves to Returned (RTO).',
  marked: 'Already cancelled on the courier’s app',
  markedHelp:
    'Nothing is sent to the courier. The shipment is marked cancelled here and the order goes back to To ship.',
  noCourierCancel:
    'This courier takes no cancellations from here. Cancel it on the courier’s own site, then pick the last option.',
  /** A courier that schedules its own pickup at booking (RapidShyp): no Cancel pickup (owner, 23 Nov 2026). */
  pickupByCourier: (courier: string) =>
    `${courier} schedules its own pickup when you book. To stop the pickup, cancel the shipment.`,
  confirm: 'Confirm',
  keep: 'Keep as it is',
  backDone: 'Pickup cancelled. The parcel is back in Booked.',
  shipmentDone: 'Shipment cancelled. The order is back in To ship.',
  sendBackDone: 'The courier was asked to bring it back. It is in Returned (RTO).',
  markedDone: 'Marked as cancelled. The order is back in To ship.',
}

/** Shipments › To book, a parcel of an order that ships in parts (Figma 918:10520). Dates come formatted ("22 Oct"). */
export const shipmentPartsContent = {
  part: (n: number, of: number) => `Part ${n} of ${of}`,
  shipped: (n: number, date: string) => `Part ${n} shipped ${date}`,
  item: (title: string, quantity: number) => `${title} × ${quantity}`,
  waiting: {
    preorder: (date: string | null) =>
      date ? `Waiting · pre-order ${date}` : 'Waiting · pre-order',
    stock: (date: string | null) => (date ? `Waiting · stock ${date}` : 'Waiting · stock'),
  },
}
