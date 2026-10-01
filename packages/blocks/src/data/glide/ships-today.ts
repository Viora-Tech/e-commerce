/** Copy and fixed UI strings for the Ships today strip (sections/ships-today.liquid). */
export const shipsTodayContent = {
  label: 'Ships today',
  /** Shown before the cut-off. `{time}` becomes the time left, e.g. "2h 14m". */
  before: 'Ships within 24-48 business hours',
  /** Shown after the cut-off. `{cutoff}` becomes the cut-off hour, e.g. "12 PM". */
  after: 'Ships within 24-48 business hours',
  /** `{count}` becomes the number of products in stock. */
  count: '{count} products in stock',
  /** Stands in for `{time}` until the countdown has run once, same as the theme. */
  timePlaceholder: '…',
  minutes: 'm',
  hours: 'h',
  am: 'AM',
  pm: 'PM',
  collectionHandle: 'all',
  cutoffHour: 12,
  timezoneOffset: 330,
  items: [
    { icon: 'payment', text: 'UPI & Cards' },
    { icon: 'location', text: 'Ships Anywhere In India' },
    { icon: 'shield', text: '1-Year Warranty On All The Keyboard & Mice' },
  ],
  newItem: { icon: 'payment', text: 'COD and UPI accepted' },
  icons: [
    { label: 'Payment', value: 'payment' },
    { label: 'Delivery', value: 'delivery' },
    { label: 'Shipping', value: 'shipping' },
    { label: 'Shield', value: 'shield' },
    { label: 'Guaranteed', value: 'guaranteed' },
    { label: 'Location', value: 'location' },
    { label: 'WhatsApp', value: 'whatsapp' },
    { label: 'Bolt', value: 'bolt' },
  ],
  /** Longest in-stock count the storefront bothers to ask the loader for. */
  stockSampleSize: 250,
  /** Counts below this just print; larger counts roll up from zero. */
  countUpFrom: 5,
  /** Roll-up length in seconds (Motion's unit). */
  countUpSeconds: 0.9,
  /** How often the countdown re-reads the clock, in milliseconds. */
  tickMs: 30_000,
} as const
