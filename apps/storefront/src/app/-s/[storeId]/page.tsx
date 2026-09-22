import { inStore } from '@/lib/store-context'
import { renderTemplate } from '@/lib/template-render'

type Params = { params: Promise<{ storeId: string }> }

export default async function Home({ params }: Params) {
  const { storeId } = await params
  return inStore(storeId, (tx) => renderTemplate(tx, storeId, 'home'))
}
