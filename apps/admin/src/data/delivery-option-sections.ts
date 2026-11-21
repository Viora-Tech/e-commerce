/** Copy for how a delivery option's settings are grouped (owner, 21 Nov 2026: "improve UI/UX a
 *  lot"): the section names on the Options page and an option's own page, the "Faster couriers
 *  cost" choice with its third item (the courier's full price), and the live checkout example
 *  line. The other option copy is in `delivery-options.ts` and `delivery-options-pages.ts`. */
export const deliveryOptionSectionsContent = {
  sections: {
    basics: { title: 'Name and status' },
    pays: {
      title: 'What the shopper pays',
      help: 'The delivery price at checkout and how it is rounded.',
    },
    couriers: {
      title: 'Which couriers show',
      help: 'Which courier is picked for the shopper’s PIN, and whether they can choose another.',
    },
    extras: {
      title: 'Insurance and cash on delivery',
      help: 'What can be added on top of the delivery price.',
    },
    dates: {
      title: 'Delivery dates',
      help: 'How the date shown at checkout is worked out.',
    },
  },
  faster: {
    label: 'Faster couriers cost',
    items: {
      difference: 'Your price plus the difference',
      full: 'The courier’s full price',
      none: 'Your price, nothing extra',
    },
    help: {
      difference: 'A courier that costs you ₹30 more shows “+ ₹30” at checkout.',
      full: 'Each faster courier shows its own delivery price, like “₹99”, never less than the first courier. A Free price or a product rule’s price covers only the first courier.',
      none: 'Every courier costs the shopper the same. You pay what faster ones cost more.',
    },
  },
  example: {
    title: 'At checkout, for example',
    note: (surface: string, air: string) =>
      `Made-up courier costs: Surface ${surface}, Air ${air}. Try a PIN shows real prices.`,
    free: 'Free',
    extra: (amount: string) => `+ ${amount}`,
    zone: 'your Shipping rate',
    freeAbove: (amount: string) => `free from ${amount}`,
    carrier: 'Delhivery',
    speeds: { standard: 'Surface', express: 'Air' },
  },
}
