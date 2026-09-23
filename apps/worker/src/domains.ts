import { createDomainProvider, type DomainTargets, pollPendingDomains } from '@commerce/core'
import type { Db } from '@commerce/db'
import { DOMAIN_VERIFY_QUEUE, type IORedis, Queue, Worker } from '@commerce/queue'

/** How often domains in flight are checked. DNS changes usually land within minutes. */
export const VERIFY_EVERY_MS = 2 * 60_000

/**
 * One repeat job checks every custom domain still waiting on DNS or on its
 * certificate, store by store. Shopify polls the same way, so a merchant who
 * adds the records and walks away still ends up connected.
 */
export function createDomainPoller(
  connection: IORedis,
  db: Db,
  opts: { provider: string; targets: DomainTargets },
) {
  const queue = new Queue(DOMAIN_VERIFY_QUEUE, { connection })
  const provider = createDomainProvider(opts.provider)
  const worker = new Worker(
    DOMAIN_VERIFY_QUEUE,
    async () => {
      const r = await pollPendingDomains(db, {
        provider,
        targets: opts.targets,
        log: (m) => console.warn(m),
      })
      if (r.checked > 0 || r.failed > 0) {
        console.log(`[domains] checked ${r.checked} in ${r.stores} stores, ${r.failed} failed`)
      }
      return r
    },
    { connection },
  )
  return { queue, worker }
}
