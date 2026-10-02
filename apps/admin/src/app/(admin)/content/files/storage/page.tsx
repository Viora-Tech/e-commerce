import type { Metadata } from 'next'
import PageBody from '@/components/layout/page-body'
import FilesSettings from './files-settings'

export const metadata: Metadata = { title: 'File storage' }

/** Content › Files › Storage: where uploads are stored (once Settings › Files). */
export default function Page() {
  return (
    <PageBody width="narrow" className="gap-4">
      <FilesSettings />
    </PageBody>
  )
}
