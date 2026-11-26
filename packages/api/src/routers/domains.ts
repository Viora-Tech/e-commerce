import {
  getDomain,
  listDomains,
  permissions,
  removeDomain,
  requestCertificateRetry,
  setDomainRedirect,
  setPrimaryDomain,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import {
  connectStoreDomain,
  domainErrorsToBadRequest,
  domainRedirectOnly as redirectOnly,
  domainTargets as targets,
  toDomainView as domainView,
  verifyStoreDomain,
} from '../services/domains.service'

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
      domainErrorsToBadRequest(() =>
        connectStoreDomain(context.tx, context.scope.storeId, input),
      ),
    ),

  /** Check DNS and SSL now instead of waiting for the worker's poll. */
  verify: manage()
    .input(byId)
    .handler(({ context, input }) =>
      domainErrorsToBadRequest(() => verifyStoreDomain(context.tx, input.id)),
    ),

  /**
   * "Retry certificate": restart the wait and queue a fresh certificate attempt (the worker
   * re-registers the host and re-checks). At most once every two minutes per domain.
   */
  retryCertificate: manage()
    .input(byId)
    .handler(({ context, input }) =>
      domainErrorsToBadRequest(async () =>
        domainView(
          await requestCertificateRetry(context.tx, context.scope.storeId, input.id),
          targets(),
        ),
      ),
    ),

  setPrimary: manage()
    .input(byId)
    .handler(({ context, input }) =>
      domainErrorsToBadRequest(async () =>
        domainView(
          await setPrimaryDomain(context.tx, context.scope.storeId, input.id, {
            apexRedirectOnly: redirectOnly(),
          }),
          targets(),
        ),
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
