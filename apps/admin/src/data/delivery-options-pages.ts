/** Copy for Apps → Delivery options' four pages as drawn in Figma (929:11373 Overview, 929:11812
 *  and 938:12101 Options, 929:12240 Routes, 929:12840 Product rules) and the app bar's pill and
 *  Preview checkout. The dialogs and the option page read `delivery-options.ts`. */
export const deliveryPagesContent = {
  /** The section heads of the app's four pages (Figma 929:11373, 11812, 12240, 12840). */
  pages: {
    overview: {
      title: 'Overview',
      intro: 'What shoppers see at checkout, and how well your couriers are answering.',
    },
    options: {
      title: 'Options',
      intro: 'The cards shoppers pick from at checkout. Drag to change the order.',
      introList: 'What shoppers choose from at checkout and on product pages.',
    },
    routes: {
      title: 'Routes',
      intro:
        'A route is one courier through one app, like Delhivery direct or Blue Dart via Shiprocket.',
    },
    rules: {
      title: 'Product rules',
      intro:
        'Which couriers some products may ship with. Rules higher in the list win when a cart can’t follow all of them.',
    },
  },
  /** Overview: the four tiles. */
  tiles: {
    live: 'Checkouts priced live',
    liveNote: (live: number, total: number) => `${live} of ${total} in the last 24 h`,
    backup: 'Fell back to zone rates',
    backupNote: (app: string, times: number) =>
      times === 1
        ? `${app} failed once`
        : times === 2
          ? `${app} failed twice`
          : `${app} failed ${times} times`,
    backupNone: 'No courier failed',
    answer: 'Typical answer time',
    answerNote: (app: string, time: string) => `${app} slowest · ${time}`,
    express: 'Shoppers picking Express',
    expressNote: (average: string) => `${average} average · last 30 days`,
    noCheckouts: 'No checkout in the last 24 h',
    noOrders: 'No orders with an option in 30 days',
    empty: '—',
    ms: (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`),
  },
  /** The checkout cards as a shopper sees them: Overview, the Options preview, Preview checkout. */
  preview: {
    atCheckout: 'At checkout now',
    forPin: (pin: string, kg: string) => `For PIN ${pin} · ${kg} kg cart`,
    previewTitle: 'Checkout preview',
    previewFor: (pin: string, kg: string) => `PIN ${pin} · ${kg} kg · prepaid`,
    editOptions: 'Edit options',
    asking: 'Asking your couriers…',
    failed: 'Could not price this PIN right now.',
    none: 'No option shows for this PIN.',
    unserviceable: 'No courier delivers to this PIN.',
    backup: 'Couriers did not answer: your Shipping rate',
    free: 'Free',
    extra: (price: string) => `+ ${price}`,
    by: (date: string) => `by ${date}`,
    usually: 'Usual delivery time',
    cod: 'Cash on delivery available',
    prepaid: 'Pay online for this option',
    air: 'Air',
    surface: 'Surface',
    off: (names: string) => `${names} switched off.`,
    hidden: (names: string) => `${names} hidden: slower and dearer, or past the limit.`,
  },
  /** Overview: the connected courier apps and how they answer. */
  apps: {
    title: 'Courier apps',
    connect: 'Connect',
    none: 'No courier app is connected yet.',
    answering: 'Answering',
    skipped: (minutes: number) => `Skipped ${minutes} min`,
    quiet: 'Not asked yet',
    noPrice: 'No live price',
    line: (rate: string, time: string | null) => (time ? `${rate} · ${time}` : rate),
    couriers: (n: number) => (n === 1 ? '1 courier' : `${n} couriers`),
    timeouts: (n: number, at: string) => `${n} failed at ${at} · saved price`,
  },
  /** The app bar: the status pill and the Preview checkout action. */
  header: {
    pill: (apps: number, live: string) =>
      `${apps === 1 ? '1 courier app' : `${apps} courier apps`} · ${live} of checkouts priced live today`,
    pillQuiet: (apps: number) =>
      `${apps === 1 ? '1 courier app' : `${apps} courier apps`} · no checkout today`,
    preview: 'Preview checkout',
    previewHelp: 'What a shopper at this PIN sees now, from your couriers’ latest answers.',
    pin: 'PIN code',
    show: 'Show',
    close: 'Close',
  },
  /** Options: how checkout shows delivery (Figma 938:12101). */
  layout: {
    label: 'How checkout shows delivery',
    list: 'Courier list (automatic)',
    listHelp:
      'Every courier you allow, priced live. The cheapest is included; faster ones show the extra.',
    recommended: 'Recommended',
    fixed: 'Fixed options',
    fixedHelp:
      'You name the cards, like Standard and Express, and each picks the cheapest or fastest courier.',
    needsOption: 'Add an option first: the courier list uses the first one’s price.',
  },
  /** Options in Fixed options: one card per option, edited in place (Figma 929:11812). */
  optionCards: {
    pickedByDefault: 'Picked by default',
    more: 'More settings',
    enabled: (name: string) => `Show ${name} at checkout`,
    drag: (name: string) => `Drag ${name}`,
    picks: 'Picks',
    pays: 'Shopper pays',
    payment: 'Payment',
    shows: 'Shows',
    picksItems: { cheapest: 'Cheapest route', fastest: 'Fastest route' },
    descriptions: {
      cheapest: 'Cheapest route for the shopper’s PIN',
      fastest: 'Fastest route for the shopper’s PIN',
    },
    paysItems: {
      route: (markup: string | null, freeAbove: string | null) =>
        `Courier cost${markup ? ` + ${markup}` : ''}${freeAbove ? ` · free above ${freeAbove}` : ''}`,
      zone: 'Your Shipping rates',
      more: 'Markup, free above… (more settings)',
    },
    paymentItems: { allowed: 'Allowed', prepaid_only: 'Prepaid only' },
    showsItems: {
      shown: 'Show delivery date · Courier name shown',
      hidden: (speed: string) => `Show delivery date · Courier name hidden · “${speed}”`,
      list: 'Every courier to pick from',
    },
    fallback: (name: string) =>
      `If no courier answers for a PIN, checkout shows ${name} at your Shipping rates, so shoppers can always pay.`,
    fallbackNone:
      'If no courier answers for a PIN, checkout shows your Shipping rates, so shoppers can always pay.',
    unsaved: 'Unsaved changes',
    discard: 'Discard',
  },
  /** Options in Courier list: the couriers and what the price includes (Figma 938:12101). */
  courierList: {
    title: 'Couriers shoppers may see',
    help: 'Found automatically from your connected apps. New couriers your apps add show up here switched off.',
    included: 'Included in price',
    new: 'New',
    direct: 'Direct · your account',
    via: (apps: string) => `via ${apps}`,
    cheaperWins: (apps: string) => `via ${apps} (cheaper wins)`,
    newSuffix: 'new',
    toggle: (name: string) => `Show ${name} to shoppers`,
    empty: 'No courier answered yet. Connect a courier app, or open this page again in a minute.',
    loading: 'Finding your couriers…',
    priceTitle: 'What the price includes',
    includedService: 'Included service',
    includedItems: {
      cheapest: 'Cheapest allowed courier for the PIN',
      fastest: 'Fastest allowed courier for the PIN',
    },
    includedHelp: (freeAbove: string | null) =>
      freeAbove
        ? `Shoppers pay your normal delivery charge (or nothing above ${freeAbove}) for this one.`
        : 'Shoppers pay your normal delivery charge for this one.',
    fasterCost: 'Faster couriers cost',
    fasterItems: { difference: 'The difference in courier price', none: 'Nothing extra' },
    round: 'Round extras up to ₹…9',
    roundHelp: '+₹37 shows as +₹39',
    hide: 'Hide couriers that are slower and dearer',
    hideHelp: 'Keeps the list short and honest',
    max: 'Show at most',
    maxItems: (n: number) => `${n} couriers`,
  },
  /** Routes: one table of every route (Figma 929:12240). */
  routeTable: {
    filters: { all: 'All', direct: 'Direct', aggregator: 'Via aggregator' },
    filtersLabel: 'Show routes',
    columns: {
      route: 'Route',
      speed: 'Speed',
      priceFrom: 'Price from',
      cod: 'COD',
      insures: 'Insures',
      rate: 'Insurance rate',
      courierName: 'Courier name',
      answering: 'Answering',
      on: 'On',
    },
    direct: 'Direct · your account',
    via: (app: string) => `via ${app}`,
    speeds: { standard: 'Surface', express: 'Express' },
    livePrice: 'Live price',
    costCard: 'Cost card',
    noPrice: 'No price',
    noLivePrice: 'No live price',
    yes: 'Yes',
    no: 'No',
    insures: 'Insures',
    contract: 'Contract',
    protect: 'Protect card',
    rate: (percent: string, min: string | null) =>
      min ? `${percent}% · min ${min}` : `${percent}%`,
    courierRate: (percent: string, gstIncluded: boolean) =>
      gstIncluded ? `${percent}% (GST incl.)` : `${percent}% + GST`,
    none: '—',
    showName: (name: string) => `Show ${name}’s name at checkout`,
    on: (name: string) => `Use ${name} at checkout`,
    edit: (name: string) => `Edit ${name}`,
    footer:
      'Click a route to edit its insurance rate, cost card (couriers without a live price) and COD fee.',
    source: (pins: string) =>
      `Listed from what your apps answer from your pickup PIN to ${pins}, cached up to 6 hours.`,
    failed: (app: string) => `${app} did not answer, so its routes are missing for now.`,
    loading: 'Asking your courier apps for their routes…',
    empty: 'No route yet. Connect a courier app to see its routes here.',
  },
  /** Product rules: one row per rule (Figma 929:12840). */
  ruleRows: {
    allOptions: 'All options',
    only: (names: string) => `${names} only`,
    insured: 'insured',
    line: (routes: string) => `Carts with these products show only ${routes} prices`,
    lineOptions: (options: string, routes: string) =>
      `${options}: carts with these products show only ${routes} prices`,
    off: 'Off',
    drag: (name: string) => `Drag ${name}`,
    deleteConfirm: 'Delete this rule? Carts follow the other rules from then on.',
  },
}
