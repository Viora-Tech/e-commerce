import { createDb, withStore } from '@commerce/db'
import { loadThemeBundle } from './src/theme-import/bundle-store'
import { storeLiquidData } from './src/theme-import/data'
import { liquidPlacement } from './src/theme-import/fields'
import { createPageContext, renderLiquidSection } from './src/theme-import/render'
import { loadTemplate } from './src/theme/templates'

const [themeId, only] = process.argv.slice(2) as [string, string]
const storeId = '01a0de8f-0350-7522-8375-547613dcae7f'
const db = createDb(process.env.DATABASE_URL as string)
await withStore(db, storeId, async (tx) => {
  const bundle = await loadThemeBundle(tx, themeId)
  if (!bundle) throw new Error('no bundle')
  const data = await storeLiquidData(tx, { storeId, host: 'localhost', origin: 'http://localhost' })
  const ctx = await createPageContext({
    bundle,
    data,
    request: { template: 'index', path: '/', host: 'localhost', origin: 'http://localhost', designMode: false, postedForm: null, nonce: '' },
    assetBase: '/x',
    shopifyHost: null,
    moneyFormat: null,
    paymentTypes: [],
  })
  for (const key of ['header', 'home', 'footer'] as const) {
    const tpl = await loadTemplate(tx, themeId, key)
    for (const item of tpl.data.content) {
      const type = String(item.props.sectionType)
      if (only && type !== only) continue
      const html = await renderLiquidSection(ctx, liquidPlacement(item.props, bundle.sections.get(type)?.schema, key, 0), (e) =>
        console.log('ERR', type, String(e).slice(0, 300)),
      )
      console.log(type, html.length)
      if (only) console.log(html.slice(0, 3000))
    }
  }
})
await db.$client.end()
