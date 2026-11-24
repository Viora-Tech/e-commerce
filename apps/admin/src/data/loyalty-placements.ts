/** The Loyalty points app's Placements page: where the widgets show on the storefront. */
export const loyaltyPlacementsContent = {
  title: 'Placements',
  subtitle: 'Where members see their points on your store. Switch each one on in your theme.',
  items: {
    widget: {
      title: 'Floating widget',
      body: 'A button in the corner of every page that opens points, rewards and ways to earn.',
    },
    productPoints: {
      title: 'Product page points',
      body: 'Shows how many points the product earns, under the price.',
    },
    cardPoints: {
      title: 'Product card points',
      body: 'A small points line on product cards in collections and search.',
    },
    cartRedeem: {
      title: 'Cart redeem',
      body: 'Lets members spend points on a reward from the cart.',
    },
    referralPopup: {
      title: 'Referral pop-up',
      body: 'Welcomes a friend who opens a referral link and shows their reward.',
    },
  },
  where: {
    embed: 'Online store › Customize › App embeds',
    block: 'Online store › Customize › add an app block to the template',
  },
  open: 'Open Customize',
  status: { ready: 'Ready', off: 'Off', unknown: 'App block' },
  noTheme: 'No live theme yet. Publish a theme to place the widgets.',
  loadFailed: 'Could not load your theme',
}
