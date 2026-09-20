import type { Metadata } from 'next'
import { PagesPage } from './pages-page'

export const metadata: Metadata = { title: 'Pages' }

export default function Page() {
  return <PagesPage />
}
