import { siteConfig } from '@commerce/config/site'

const brand = siteConfig.brand.name

/**
 * A channel's "What happens next" while it waits for approval. Waiting means sign-in with Meta or
 * Google is not switched on for the platform yet (no app keys), not that the partner is reviewing
 * the shop. Once it is, "Connect now" finishes the request in one step.
 */
export const salesChannelsWaitingContent = {
  title: 'What happens next',
  steps: (partner: string) => [
    `${brand} switches on sign-in with ${partner} for your shop. We email you when it is ready.`,
    `Then come back here and press Connect now. You sign in to ${partner} once and pick what to share.`,
    'Nothing is shared until you finish connecting. Withdraw the request any time from View request.',
  ],
  ready: (partner: string) =>
    `Sign-in with ${partner} is ready. Connect now to finish what you asked for.`,
  connectNow: 'Connect now',
}
