/** Copy for the Delivery options product rule dialog's four steps (owner, 20 Nov 2026): which
 *  products, which couriers shoppers can choose from, which courier is included in the price,
 *  what it costs; the quick starts, the "Shoppers will see" example, and the Product rules page's
 *  suggestions from Shipping rates and its order advice. Hindi: `hi/delivery-rule-form.ts`. */
export const deliveryRuleFormContent = {
  presets: {
    label: 'Quick start',
    help: 'Fills the form. You can change anything before you save.',
    items: {
      freePreferred: {
        title: 'Free with a preferred courier',
        body: 'Like mice: free by one courier, shoppers can pick another and pay the difference.',
      },
      oneFree: {
        title: 'One courier only, free',
        body: 'Like glass pads: always the same courier, no other choice.',
      },
      paidCheapest: {
        title: 'Paid, cheapest first',
        body: 'Like skates: the normal delivery price, cheapest courier first.',
      },
    },
  },
  steps: {
    products: 'Which products?',
    couriers: 'Which couriers can carry them?',
    couriersHelp: 'Shoppers can choose from these couriers.',
    included: 'Which courier is included in the price?',
    includedHelp:
      'It shows first and is marked Recommended. When it can’t reach the PIN code, the next courier takes its place at the same price.',
    price: 'What does the included courier cost the shopper?',
    priceHelp: 'Other couriers cost this plus their difference. Express keeps its own price.',
  },
  chips: {
    speeds: { standard: 'Surface', express: 'Air', any: 'any speed' },
    toggle: (name: string) => `Shoppers can choose ${name}`,
    loading: 'Finding your connected couriers…',
    none: 'No connected courier answered yet. Connect a courier app, or try again in a minute.',
    notConnected: 'not connected',
    retry: 'Try again',
  },
  included: {
    cheapest: 'The cheapest one',
    recommended: 'Recommended',
    onlyThis: 'Only this one, hide the others',
    onlyThisHelp:
      'Shoppers see no other courier. Where it doesn’t deliver, the other ticked couriers are used.',
    pickFirst: 'Pick a courier above to make it the included one.',
  },
  price: {
    option: 'Normal delivery price',
    optionHelp: 'What the delivery option charges today.',
    free: 'Free',
    fixed: 'Fixed',
    fixedLabel: 'Fixed price in rupees',
    freeAbove: 'Free above',
    freeAboveLabel: 'Free above this cart value, in rupees',
    freeAboveHelp: 'Cart value after discounts.',
    errors: { fixed: 'Type the price.', freeAbove: 'Type the cart value.' },
  },
  more: {
    through: 'Through',
  },
  sample: {
    title: 'Shoppers will see',
    example: 'Example: courier costs here are made up, to show how this rule prices.',
    free: 'Free',
    recommended: 'Recommended',
    extra: (amount: string) => `+ ${amount}`,
    total: (total: string, extra: string) => `${total} (+ ${extra})`,
    freeAbove: (amount: string) => `Free for carts of ${amount} or more.`,
    express: 'Express, when you offer it, keeps its own price.',
    empty: 'Tick a courier to see the example.',
  },
  suggestions: {
    title: 'Suggested from your shipping rates',
    help: 'From Settings → Shipping rates. Nothing changes until you save the rule.',
    add: 'Add rule',
    products: (n: number) => (n === 1 ? '1 product' : `${n} products`),
    allProducts: 'All products',
    rates: (low: string, high: string) => (low === high ? low : `${low} – ${high}`),
    price: {
      free: 'Free',
      fixed: (amount: string) => `Fixed ${amount}`,
      option: 'Normal price',
      freeAbove: (amount: string) => `free above ${amount}`,
    },
  },
  order: {
    title: 'Rule order',
    sort: 'Sort by most specific',
    sorted: 'Rules sorted.',
    moveAbove: (specific: string, broad: string) => `${specific} above ${broad}`,
    why: 'A rule for fewer products should sit above a broader one, so the list reads in the order checkout applies them.',
    kinds: {
      products: 'products',
      collections: 'a collection',
      tags: 'a tag',
      types: 'a product type',
      all: 'all products',
    },
    named: (name: string, kind: string) => `${name} (${kind})`,
    warnings: {
      title: 'Rules that can block delivery',
      oneCourier: (name: string, courier: string) =>
        `${name} allows only ${courier}: shoppers get no choice, and these products can’t be delivered where ${courier} doesn’t go.`,
      allOneCourier: (name: string, courier: string) =>
        `${name} is for all products and allows only ${courier}: no order can be delivered where ${courier} doesn’t go.`,
      twin: (rule: string, ruled: string, other: string, n: number) =>
        `${rule} names the collection “${ruled}” but not “${other}”: ${n === 1 ? '1 product' : `${n} products`} there don’t follow the rule.`,
    },
  },
}
