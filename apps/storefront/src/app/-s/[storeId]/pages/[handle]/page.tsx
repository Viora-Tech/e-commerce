import { page } from '@commerce/db'
import { eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import MainPage from '@/components/pages/main-page'
import { inStore } from '@/lib/store-context'
import { isThemePreview, renderTemplate } from '@/lib/template-render'

type Params = {
  params: Promise<{ storeId: string; handle: string }>
  searchParams: Promise<{ view?: string }>
}

async function findPage(storeId: string, handle: string) {
  const [found] = await inStore(storeId, (tx) =>
    tx.select().from(page).where(eq(page.handle, handle)),
  )
  return found ?? null
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { storeId, handle } = await params
  const found = await findPage(storeId, handle)
  if (!found) return {}
  return { title: found.seoTitle || found.title, description: found.seoDescription || undefined }
}

export default async function StorePage({ params, searchParams }: Params) {
  const { storeId, handle } = await params
  const { view } = await searchParams
  const found = await findPage(storeId, handle)
  // Hidden pages 404 for shoppers; Customize can still preview their template.
  if (!found || (!found.publishedAt && !(await isThemePreview(storeId)))) notFound()
  return inStore(storeId, (tx) =>
    renderTemplate(tx, storeId, 'page', {
      suffix: found.templateSuffix,
      view,
      renderers: {
        MainPage: (s) => (
          <MainPage title={found.title} body={found.body} showTitle={s.showTitle !== false} />
        ),
      },
    }),
  )
}
