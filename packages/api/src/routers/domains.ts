import { loadEnv } from '@commerce/config'
import {
  connectDomain,
  createDomainProvider,
  DomainError,
  type DomainTargets,
  domainView,
  getDomain,
  listDomains,
  permissions,
  removeDomain,
  setDomainRedirect,
  setPrimaryDomain,
  verifyDomain,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'

const env = () => loadEnv(process.env)
const targets = (): DomainTargets => ({
  aRecord: env().STOREFRONT_A_RECORD,
  cnameTarget: env().STOREFRONT_CNAME_TARGET,
})

async function domainErrorsToBadRequest<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof DomainError) throw new ORPCError('BAD_REQUEST', { message: err.message })
    throw err
  }
}

const read = () => can(permissions.SETTINGS_READ)
const manage = () => can(permissions.SETTINGS_MANAGE)
const byId = z.object({ id: z.uuid() })

export const domainsRouter = {
  /** Every hostname this store answers on, with the records each still needs. */
  list: read().handler(async ({ context }) => {
    const t = targets()
    return (await listDomains(context.tx)).map((d) => domainView(d, t))
  }),

  get: read()
    .input(byId)
    .handler(async ({ context, input }) => {
      const d = await getDomain(context.tx, input.id)
      if (!d) throw new ORPCError('NOT_FOUND', { message: 'Domain not found' })
      return domainView(d, targets())
    }),

  /** Connect a custom domain (and optionally its www twin as a redirect); starts pending. */
  connect: manage()
    .input(
      z.object({
        hostname: z.string().trim().min(1).max(300),
        redirectToPrimary: z.boolean().optional(),
        includeWwwTwin: z.boolean().optional(),
      }),
    )
    .handler(({ context, input }) =>
      domainErrorsToBadRequest(async () => {
        const t = targets()
        const rows = await connectDomain(context.tx, context.scope.storeId, input, {
          platformRoots: env().PLATFORM_DOMAINS,
          targets: t,
        })
        return rows.map((d) => domainView(d, t))
      }),
    ),

  /** Check DNS and SSL now instead of waiting for the worker's poll. */
  verify: manage()
    .input(byId)
    .handler(({ context, input }) =>
      domainErrorsToBadRequest(async () => {
        const t = targets()
        const d = await verifyDomain(context.tx, input.id, {
          provider: createDomainProvider(env().DOMAIN_PROVIDER),
          targets: t,
        })
        return domainView(d, t)
      }),
    ),

  setPrimary: manage()
    .input(byId)
    .handler(({ context, input }) =>
      domainErrorsToBadRequest(async () =>
        domainView(await setPrimaryDomain(context.tx, context.scope.storeId, input.id), targets()),
      ),
    ),

  setRedirect: manage()
    .input(z.object({ id: z.uuid(), redirectToPrimary: z.boolean() }))
    .handler(({ context, input }) =>
      domainErrorsToBadRequest(async () =>
        domainView(
          await setDomainRedirect(
            context.tx,
            context.scope.storeId,
            input.id,
            input.redirectToPrimary,
          ),
          targets(),
        ),
      ),
    ),

  remove: manage()
    .input(byId)
    .handler(({ context, input }) =>
      domainErrorsToBadRequest(async () => ({
        removed: await removeDomain(context.tx, context.scope.storeId, input.id),
      })),
    ),
}
