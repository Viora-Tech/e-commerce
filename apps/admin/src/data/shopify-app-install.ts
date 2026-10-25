import { siteConfig } from '@commerce/config/site'

/** Copy for Shopify importer → Connect → "Install the <brand> app" (the platform's Shopify app). */
export const shopifyAppInstallContent = {
  badge: 'One click',
  stepsHeading: `Install the ${siteConfig.brand.name} app on Shopify`,
  steps: [
    'Type your Shopify store address and press Install.',
    'Shopify shows the app and the read-only access it asks for. Press Install there.',
    'You come back here connected, ready to choose what to bring over.',
  ],
  note: 'The app only reads. It never changes anything in your Shopify store, and you can remove it from Shopify (Settings, Apps) at any time.',
  formHeading: 'Your Shopify store',
  submit: 'Install',
  redirecting: 'Opening Shopify…',
  failed: 'Could not start the install. Check the address and try again.',
  result: {
    connected: `Shopify store connected through the ${siteConfig.brand.name} app`,
    failed: 'Shopify did not finish the install. Try again.',
    cancelled: 'The install was cancelled.',
  },
}
