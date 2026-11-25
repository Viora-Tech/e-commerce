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
      body: 'Shows how many points the product earns, under the price.',
    },
    cardPoints: {
      title: 'Product card',
      body: 'A small points line on product cards in collections and search.',
    },
    cartRedeem: {
      title: 'Cart placement',
      body: 'Lets members spend points on a reward from the cart.',
    },
    referralPopup: {
      title: 'Referral pop-up',
      body: 'Welcomes a friend who opens a referral link and shows their reward.',
    },
  },
  where: {
    embed: 'Customize › App embeds',
    block: 'Customize › add an app block to the template',
  },
  open: 'Customize',
  enableEmbed: 'Enable app embed',
  status: { live: 'Live', disabled: 'Disabled', ready: 'Ready' },
  noTheme: 'No live theme yet. Publish a theme to place the widgets.',
  loadFailed: 'Could not load your theme',
}
