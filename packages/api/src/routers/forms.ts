import { permissions } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { FORMS_ID, listContactMessages, messageText } from '@commerce/plugin-forms/server'
import { ORPCError } from '@orpc/server'
import { can } from '../procedures'
import { getStoreApps } from '../services/apps.service'

type Ctx = { tx: StoreTx; scope: { storeId: string } }

async function requireInstalled(context: Ctx) {
  const apps = await getStoreApps(context.tx, context.scope.storeId)
  if (!apps.installed.includes(FORMS_ID)) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Install the Forms app first' })
  }
}

export const formsRouter = {
  submissions: {
    /** The latest messages from the theme's contact and advice forms, newest first. */
    list: can(permissions.CUSTOMERS_READ).handler(async ({ context }) => {
      await requireInstalled(context)
      const rows = await listContactMessages(context.tx)
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        text: messageText(r),
        path: r.path,
        createdAt: r.createdAt,
      }))
    }),
  },
}
