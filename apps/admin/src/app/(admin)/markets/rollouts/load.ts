import type { RolloutPageData } from '@/components/rollouts/rollout-page-data'
import { appRouter, call, type serverContext } from '@/lib/api'

type Context = Awaited<ReturnType<typeof serverContext>>

/**
 * What the rollout page picks from: the theme library and the checkout as it is now (its
 * branding is where a new checkout change starts). The checkout needs Settings: read; without it
 * the page offers no checkout change. The markets are what an A/B test can be limited to.
 */
export async function loadRolloutPage(context: Context): Promise<RolloutPageData> {
  const [themes, checkout, markets] = await Promise.all([
    call(appRouter.rollouts.listThemes, undefined, { context }),
    call(appRouter.checkoutSettings.get, undefined, { context }).catch(() => null),
    call(appRouter.rollouts.listMarkets, undefined, { context }),
  ])
  return {
    themes,
    checkout: checkout
      ? {
          branding: checkout.settings.branding,
          orderNotes: checkout.settings.orderNotes,
          storeName: checkout.storeName,
        }
      : null,
    markets,
  }
}
