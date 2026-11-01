import type { Metadata } from 'next'
import CatalogForm from '@/components/catalogs/catalog-form'
import { serverContext } from '@/lib/api'
import { loadCatalogPage } from '../load'

export const metadata: Metadata = { title: 'New catalog' }

export default async function Page() {
  const { markets, catalogs } = await loadCatalogPage(await serverContext())
  return <CatalogForm catalog={null} markets={markets} catalogs={catalogs} />
}
