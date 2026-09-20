import { notFound, redirect } from 'next/navigation'
import { appRouter, call, serverContext } from '@/lib/api'
import { ProductForm } from './product-form'

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await serverContext()
  const product = await call(appRouter.products.get, { id }, { context }).catch(() => undefined)
  if (product === undefined) redirect('/select-store')
  if (!product) notFound()
  return <ProductForm product={product} />
}
