import 'server-only'
import { loadEnv } from '@commerce/config'
import { nudgeOutboxRelay, outboxRelayQueue } from '@commerce/queue'

/**
 * Nudge the worker's outbox relay right after a commit that wrote an
 * outbox row (placing an order, a payment capture). The relay's periodic
 * sweep already guarantees delivery within a few seconds; this shaves that
 * down to near-immediate for the shopper waiting on the thank-you page.
 * Never throws (see `nudgeOutboxRelay`).
 */
export async function nudgeOutbox(storeId: string): Promise<void> {
  await nudgeOutboxRelay(outboxRelayQueue(loadEnv(process.env).REDIS_URL), storeId)
}
