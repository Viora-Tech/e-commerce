/**
 * Copy for a payment gateway that refused the store's API keys: the banner on Home and
 * Settings → Payments while checkout hides that gateway.
 */
export const gatewayKeysContent = {
  banner: {
    title: (name: string) => `${name} rejected your API keys — re-enter them`,
    body: (name: string) =>
      `Shoppers cannot pay with ${name} right now, so checkout hides it and offers your other ways to pay. Copy the Key ID and Key secret again from your ${name} dashboard, both from the same mode (Test or Live), and save them.`,
    said: (name: string, words: string) => `${name} said: “${words}”`,
    since: (when: string) => `Since ${when}. Checkout checks the keys again every 10 minutes.`,
    action: 'Re-enter the keys',
  },
}
