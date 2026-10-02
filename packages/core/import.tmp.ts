import { readFileSync } from 'node:fs'
import { createDb, withStore } from '@commerce/db'
import { storageForStore } from './src/media/settings'
import { registriesForStore } from './src/plugins/registries'
import { importShopifyTheme } from './src/theme-import/import'

const zip = new Uint8Array(
  readFileSync('C:/Users/kulde/AppData/Local/Temp/claude/E--Dev-my-e-commerce/e6bc7864-28df-4179-a963-cf09647dc567/scratchpad/zero-drift.zip'),
)
const storeId = '01a0de8f-0350-7522-8375-547613dcae7f'
const db = createDb(process.env.DATABASE_URL as string)
const result = await withStore(db, storeId, async (tx) => {
  const { storage } = await registriesForStore(tx, storeId)
  const provider = await storageForStore(tx, storeId, storage, process.env.SETTINGS_SECRET as string)
  return importShopifyTheme(tx, storeId, { zip, fileName: 'zero-drift.zip', shopifyHost: 'waimers.in' }, { storage: provider })
})
console.log(result.themeId, JSON.stringify(result.report.images), result.report.videos)
await db.$client.end()
