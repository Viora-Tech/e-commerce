import { loadEnv } from '@commerce/config'
import { permissions } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { UMAMI_ID, UmamiSettingsPatchSchema } from '@commerce/plugin-umami/settings'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import { getStoreApps } from '../services/apps.service'
import {
  createUmamiWebsite,
  getUmamiSettings,
  saveUmamiSettings,
  testUmami,
  type UmamiEnv,
  umamiReportFor,
} from '../services/umami.service'

type Ctx = { tx: StoreTx; scope: { storeId: string } }

const rangeInput = z.object({
  key: z.enum(['today', '7d', '30d', '90d', 'custom']).default('30d'),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
})

function umamiEnv(): UmamiEnv {
  const env = loadEnv(process.env)
  return {
    secret: env.SETTINGS_SECRET,
    trustedOrigins: env.UMAMI_TRUSTED_ORIGINS,
    storefrontUrl: env.STOREFRONT_URL,
  }
}

async function requireInstalled(context: Ctx) {
  const apps = await getStoreApps(context.tx, context.scope.storeId)
  if (!apps.installed.includes(UMAMI_ID)) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Install the Umami app first' })
  }
}

/** The Umami app: its settings page, and the visitor section of the Analytics page. */
export const umamiRouter = {
  settings: {
    get: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
      await requireInstalled(context)
      return getUmamiSettings(context.tx, context.scope.storeId)
    }),
    save: can(permissions.SETTINGS_MANAGE)
      .input(UmamiSettingsPatchSchema)
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        return saveUmamiSettings(context.tx, context.scope.storeId, input, umamiEnv())
      }),
    /** Reads the website with the saved key: address, key and website id all work. */
    test: can(permissions.SETTINGS_MANAGE).handler(async ({ context }) => {
      await requireInstalled(context)
      return testUmami(context.tx, context.scope.storeId, umamiEnv())
    }),
    /** Creates a website for this store in Umami and saves its id. */
    createWebsite: can(permissions.SETTINGS_MANAGE).handler(async ({ context }) => {
      await requireInstalled(context)
      return createUmamiWebsite(context.tx, context.scope.storeId, umamiEnv())
    }),
  },
  /** Visitors, page views and the ranked lists for one range; a drawable state, never an error. */
  report: can(permissions.ANALYTICS_READ)
    .input(z.object({ range: rangeInput.default({ key: '30d' }) }))
    .handler(({ context, input }) =>
      umamiReportFor(context.tx, context.scope.storeId, input.range, umamiEnv()),
    ),
}
