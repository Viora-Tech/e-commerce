import 'server-only'
import { storeAppsSettings } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { FORMS_ID } from '@commerce/plugin-forms/server'

/** Whether the store installed the Forms app, so a theme's contact form can send. */
export async function formsInstalled(tx: StoreTx, storeId: string): Promise<boolean> {
  return (await storeAppsSettings(tx, storeId)).installed.includes(FORMS_ID)
}
