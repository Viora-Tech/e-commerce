import type { PageData } from '@commerce/blocks/puck'
import { page } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { renderPage } from '@/lib/page-render'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string; handle: string }> }

export default async function BuilderPage({ params }: Params) {
  const { storeId, handle } = await params
  return inStore(storeId, async (tx) => {
    const [p] = await tx
      .select({ publishedData: page.publishedData })
      .from(page)
      .where(eq(page.handle, handle))
    if (!p?.publishedData) notFound()
    return renderPage(tx, p.publishedData as PageData)
  })
}
