/** Copy for the 3-question delivery settings (owner, 21 Nov 2026: the Options page was "still so
 *  confusing"): "Who pays for delivery?", "Can shoppers pick a faster courier?" and "Round prices
 *  to", the one collapsed "More settings", and the one-line summary on a fixed option's card.
 *  Section names and the live example line are in `delivery-option-sections.ts`. */
export const deliveryOptionQuestionsContent = {
  title: 'Delivery price',
  whoPays: {
    title: 'What does the shopper pay for delivery?',
    items: {
      route: {
        label: 'What the courier charges',
        help: 'The real courier cost for that parcel and PIN code, plus any markup you add in More settings.',
      },
      zone: {
        label: 'My own fixed rates',
        help: 'The rates you set in Settings → Shipping and delivery. The courier cost is not used.',
      },
      free: {
        label: 'Nothing: free delivery',
        help: 'The shopper sees FREE. You pay the courier.',
      },
    },
  },
  faster: {
    title: 'Show faster couriers at checkout?',
    items: {
      no: {
        label: () => 'No, one courier only',
        help: 'The shopper gets one delivery choice: the first courier that delivers to their PIN.',
      },
      difference: {
        label: (amount: string | null) =>
          amount
            ? `Yes, shopper pays only the difference (+ ${amount})`
            : 'Yes, shopper pays only the difference',
        help: 'A faster courier costs the shopper just what it costs you more than the first one.',
      },
      full: {
        label: (amount: string | null) =>
          amount
            ? `Yes, shopper pays the faster courier’s full price (${amount})`
            : 'Yes, shopper pays the faster courier’s full price',
        help: 'Each courier shows its own price. A faster one never shows cheaper than the first.',
      },
    },
    sameNote:
      'Faster couriers now cost the same as the first, set in More settings. Pick a card to change it.',
  },
  round: {
    title: 'Round the delivery price?',
    items: {
      nine: { label: 'Yes, to end in 9', help: '₹43 becomes ₹49, ₹58 becomes ₹59' },
      fifty: { label: 'Yes, to end in 49 or 99', help: '₹43 becomes ₹49, ₹58 becomes ₹99' },
      ten: { label: 'Yes, up to the next ₹10', help: '₹43 becomes ₹50' },
      off: { label: 'No, show the exact price', help: '₹43 stays ₹43' },
    },
  },
  more: {
    title: 'More settings',
    hintList: 'Markup, limits, insurance, COD fee',
    hintOption: 'Markup, limits, couriers, insurance, COD, dates',
    changed: (n: number) => `${n} changed`,
    price: 'Price',
    sameAsFirst: 'Faster couriers at the first courier’s price',
    sameAsFirstHelp:
      'Every courier costs the shopper the same. You pay what faster ones cost more. Rarely wanted.',
  },
  summary: {
    pays: {
      route: 'Courier cost + markup',
      zone: 'Your Shipping rates',
      free: 'Free delivery',
    },
    faster: {
      no: 'One courier',
      difference: 'Faster couriers: the extra',
      full: 'Faster couriers: full price',
      same: 'Every courier at one price',
    },
    rounding: {
      nine: 'Prices end in 9',
      fifty: 'Prices end in 49 or 99',
      ten: 'Rounded up to ₹10',
      off: 'Not rounded',
    },
    edit: 'Edit',
    editLabel: (name: string) => `Edit ${name}`,
  },
}
