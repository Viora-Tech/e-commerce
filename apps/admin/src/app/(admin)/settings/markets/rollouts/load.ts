import type { RolloutPageData } from '@/components/settings/rollouts/rollout-page-data'
import { appRouter, call, type serverContext } from '@/lib/api'

type Context = Awaited<ReturnType<typeof serverContext>>

/**
 * What the rollout page picks from: the theme library and the checkout as it is now (its
 * branding is where a new checkout change starts). The checkout needs Settings: read; without it
 * the page offers no checkout change.
 */
export async function loadRolloutPage(context: Context): Promise<RolloutPageData> {
  const [themes, checkout] = await Promise.all([
    call(appRouter.rollouts.listThemes, undefined, { context }),
    call(appRouter.checkoutSettings.get, undefined, { context }).catch(() => null),
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
  }
}
