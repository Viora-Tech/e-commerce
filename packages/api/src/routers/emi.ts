import { permissions } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { EMI_PAY_LATER_ID, EmiWidgetSettingsPatchSchema } from '@commerce/plugin-emi/offer'
import { ORPCError } from '@orpc/server'
import { can } from '../procedures'
import { getStoreApps } from '../services/apps.service'
import { getEmiSettings, saveEmiSettings } from '../services/emi.service'

type Ctx = { tx: StoreTx; scope: { storeId: string } }

async function requireInstalled(context: Ctx) {
  const apps = await getStoreApps(context.tx, context.scope.storeId)
  if (!apps.installed.includes(EMI_PAY_LATER_ID)) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Install the EMI & pay later app first' })
  }
}

export const emiRouter = {
  settings: {
    get: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
      await requireInstalled(context)
      return getEmiSettings(context.tx, context.scope.storeId)
    }),
    save: can(permissions.SETTINGS_MANAGE)
      .input(EmiWidgetSettingsPatchSchema)
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        return saveEmiSettings(context.tx, context.scope.storeId, input)
      }),
  },
}
