import 'server-only'
import { parseAppsSettings } from '@commerce/core'
import { type StoreTx, store } from '@commerce/db'
import { FORMS_ID } from '@commerce/plugin-forms/server'
import { eq } from 'drizzle-orm'

/** Whether the store installed the Forms app, so a theme's contact form can send. */
export async function formsInstalled(tx: StoreTx, storeId: string): Promise<boolean> {
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  return parseAppsSettings(s?.apps).installed.includes(FORMS_ID)
}
