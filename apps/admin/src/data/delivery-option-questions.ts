/** Copy for the 3-question delivery settings (owner, 21 Nov 2026: the Options page was "still so
 *  confusing"): "Who pays for delivery?", "Can shoppers pick a faster courier?" and "Round prices
 *  to", the one collapsed "More settings", and the one-line summary on a fixed option's card.
 *  Section names and the live example line are in `delivery-option-sections.ts`. */
export const deliveryOptionQuestionsContent = {
  title: 'Delivery price',
  whoPays: {
    title: 'Who pays for delivery?',
    items: {
      route: {
        label: 'Shopper pays the courier cost (+ your markup)',
        help: 'What the courier charges you, plus any markup set in More settings.',
      },
      zone: {
        label: 'Your Shipping rates',
        help: 'The rates you typed in Settings, Shipping and delivery.',
      },
      free: {
        label: 'Free delivery, you pay the courier',
        help: 'Shoppers pay nothing for the included courier.',
      },
    },
  },
  faster: {
    title: 'Can shoppers pick a faster courier?',
    items: {
      no: {
        label: () => 'No, show one courier only',
        help: 'Checkout shows only the included courier.',
      },
      difference: {
        label: (amount: string | null) =>
          amount ? `Yes, they pay the extra (+ ${amount})` : 'Yes, they pay the extra',
        help: 'A faster courier shows only what it costs you more.',
      },
      full: {
        label: (amount: string | null) =>
          amount ? `Yes, they pay its full price (${amount})` : 'Yes, they pay its full price',
        help: 'A faster courier shows its own delivery price, never less than the first.',
      },
    },
    sameNote:
      'Faster couriers now cost the same as the first, set in More settings. Pick a card to change it.',
  },
  round: {
    title: 'Round prices to',
    items: { nine: '₹…9', fifty: '₹…49/…99', ten: '₹10', off: 'Off' },
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
    rounded: (to: string) => `Rounded to ${to}`,
    notRounded: 'Not rounded',
    edit: 'Edit',
    editLabel: (name: string) => `Edit ${name}`,
  },
}
