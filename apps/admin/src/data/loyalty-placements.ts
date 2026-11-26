/** The Loyalty points app's Placements page ("Onsite elements"): where the widgets show on the storefront. */
export const loyaltyPlacementsContent = {
  title: 'Onsite elements',
  subtitle: 'Where members see their points on your store. Switch each one on in your theme.',
  section: 'Onsite content',
  items: {
    widget: {
      title: 'Floating widget',
      body: 'A button in the corner of every page that opens points, rewards and ways to earn.',
    },
    productPoints: {
      title: 'Product page',
      body: 'Shows how many points the product earns, above Add to cart. The floating widget adds it; an app block can place it elsewhere.',
    },
    cardPoints: {
      title: 'Product card',
      body: 'A small points line on product cards in collections and search.',
    },
    cartRedeem: {
      title: 'Cart placement',
      body: 'Points for the order above Checkout, in the cart and the cart drawer. Members redeem a reward and apply it without leaving the cart.',
    },
    referralPopup: {
      title: 'Referral pop-up',
      body: 'Welcomes a friend who opens a referral link and shows their reward.',
    },
  },
  /** Pages the program adds to the store, switched on and off here. */
  pages: {
    embedded: 'Embedded content',
    accounts: 'Customer accounts',
    items: {
      landing: {
        title: 'Loyalty landing page',
        body: 'A page that explains your program: how it works, ways to earn and redeem, referrals and questions. Link to it from a menu.',
      },
      account: {
        title: 'Account page',
        body: 'A Points section in the customer account: balance, history, rewards to claim and the referral link.',
      },
      accountStatus: {
        title: 'Loyalty status',
        body: 'The points balance and rewards ready to claim, at the top of the account’s Orders page.',
      },
    },
    on: 'On',
    off: 'Off',
    switchOn: (title: string) => `Show ${title}`,
    view: 'View page',
    saved: 'Saved',
    failed: 'Could not save. Try again.',
  },
  where: {
    embed: 'Customize › App embeds',
    block: 'Customize › add an app block to the template',
    widget: 'On with the floating widget (Customize › App embeds)',
  },
  open: 'Customize',
  enableEmbed: 'Enable app embed',
  status: { live: 'Live', disabled: 'Disabled', ready: 'Ready' },
  noTheme: 'No live theme yet. Publish a theme to place the widgets.',
  loadFailed: 'Could not load your theme',
}
