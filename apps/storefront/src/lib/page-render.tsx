import { createBlocksConfig, type PageData } from '@commerce/blocks/puck'
import type { StoreTx } from '@commerce/db'
import { Render, resolveAllData } from '@measured/puck'
import { listCardProducts } from './catalog'

/**
 * Render a published Puck page. Product blocks are resolved server-side
 * through the database loader before rendering, so the page is static HTML.
 */
export async function renderPage(tx: StoreTx, data: PageData) {
  const config = createBlocksConfig(({ productType, limit }) =>
    listCardProducts(tx, limit, productType),
  )
  const resolved = await resolveAllData(data, config)
  return <Render config={config} data={resolved} />
}
