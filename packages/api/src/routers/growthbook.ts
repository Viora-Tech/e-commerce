import { loadEnv } from '@commerce/config'
import { permissions } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { GROWTHBOOK_ID, GrowthbookSettingsPatchSchema } from '@commerce/plugin-growthbook/settings'
import { ORPCError } from '@orpc/server'
import { can } from '../procedures'
import { getStoreApps } from '../services/apps.service'
import {
  type GrowthbookEnv,
  getGrowthbookSettings,
  growthbookExperimentsFor,
  saveGrowthbookSettings,
  testGrowthbook,
} from '../services/growthbook.service'

type Ctx = { tx: StoreTx; scope: { storeId: string } }

function growthbookEnv(): GrowthbookEnv {
  const env = loadEnv(process.env)
  return { secret: env.SETTINGS_SECRET, trustedOrigins: env.GROWTHBOOK_TRUSTED_ORIGINS }
}

async function requireInstalled(context: Ctx) {
  const apps = await getStoreApps(context.tx, context.scope.storeId)
  if (!apps.installed.includes(GROWTHBOOK_ID)) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Install the GrowthBook app first' })
  }
}

/** The GrowthBook app: its connection settings and the experiments it lists. */
export const growthbookRouter = {
  settings: {
    get: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
      await requireInstalled(context)
      return getGrowthbookSettings(context.tx, context.scope.storeId)
    }),
    save: can(permissions.SETTINGS_MANAGE)
      .input(GrowthbookSettingsPatchSchema)
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        return saveGrowthbookSettings(context.tx, context.scope.storeId, input, growthbookEnv())
      }),
    /** Reads the SDK connection (and the experiment list with a secret key). */
    test: can(permissions.SETTINGS_MANAGE).handler(async ({ context }) => {
      await requireInstalled(context)
      return testGrowthbook(context.tx, context.scope.storeId, growthbookEnv())
    }),
  },
  /** The experiments GrowthBook has for this connection; a drawable state, never an error. */
  experiments: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    await requireInstalled(context)
    return growthbookExperimentsFor(context.tx, context.scope.storeId, growthbookEnv())
  }),
}
