import type { Metadata } from 'next'
import PageBody from '@/components/layout/page-body'
import StorageUsage from '@/components/media/storage-usage'
import { appRouter, call, serverContext } from '@/lib/api'
import FilesSettings from './files-settings'

export const metadata: Metadata = { title: 'File storage' }

/** Content › Files › Storage: what the uploads take up, then where they are stored. */
export default async function Page() {
  const context = await serverContext()
  const usage = await call(appRouter.media.usage, undefined, { context })
  return (
    <PageBody width="narrow" className="gap-4">
      <StorageUsage usage={usage} />
      <FilesSettings />
    </PageBody>
  )
}
