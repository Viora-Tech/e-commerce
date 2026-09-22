import type { Metadata } from 'next'
import FilesSettings from './files-settings'

export const metadata: Metadata = { title: 'Files' }

export default function Page() {
  return <FilesSettings />
}
