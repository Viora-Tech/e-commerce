import type { Metadata } from 'next'
import { ProductsListPage } from '@/components/products/products-list-page'

export const metadata: Metadata = { title: 'Products' }

export default function ProductsPage() {
  return <ProductsListPage />
}
