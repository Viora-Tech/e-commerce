import type { PageData } from '@commerce/blocks/puck'
import { page } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { renderPage } from '@/lib/page-render'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string }> }

export default async function Home({ params }: Params) {
  const { storeId } = await params
  return inStore(storeId, async (tx) => {
    const [home] = await tx
      .select({ publishedData: page.publishedData })
      .from(page)
      .where(eq(page.handle, 'home'))
    if (!home?.publishedData) {
      return (
        <main className="page-width" style={{ padding: '4rem 0' }}>
          <h1>Nothing published yet</h1>
          <p className="text-body">Publish the home page from the admin to see it here.</p>
        </main>
      )
    }
    return renderPage(tx, home.publishedData as PageData)
  })
}
