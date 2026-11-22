/** Customer page › More actions › "Sign in as customer". Mounted on `customers`. */
import { loadEnv } from '@commerce/config'
import {
  mintStaffSignIn,
  permissions,
  STAFF_SIGN_IN_PATH,
  storefrontOriginFor,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'

export const customerSignInAsRoutes = {
  /**
   * A single-use link (2 minutes) that signs the opener in to the storefront as this customer
   * for an hour. Notes it on the customer's timeline; the activity log records who did it.
   */
  signInAs: can(permissions.CUSTOMERS_SIGN_IN_AS)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const ctx = { tx: context.tx, storeId: context.scope.storeId }
      const user = context.session.user
      const minted = await mintStaffSignIn(ctx, {
        customerId: input.id,
        staff: { userId: user.id, name: user.name, email: user.email || null },
      })
      if (!minted.ok) {
        if (minted.reason === 'not_found') {
          throw new ORPCError('NOT_FOUND', { message: 'Customer not found' })
        }
        throw new ORPCError('BAD_REQUEST', {
          message: 'An erased or merged customer cannot be signed in as.',
        })
      }
      context.activity.note({ resourceId: input.id, label: minted.customerName })
      const origin = await storefrontOriginFor(
        context.tx,
        context.scope.storeId,
        loadEnv(process.env).STOREFRONT_URL,
      )
      const url = new URL(STAFF_SIGN_IN_PATH, origin)
      url.searchParams.set('token', minted.token)
      return { url: url.toString() }
    }),
}
