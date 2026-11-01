import { ORPCError } from '@orpc/server'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SupplierForm from '@/components/suppliers/supplier-form'
import { suppliersContent } from '@/data/purchasing'
import { appRouter, call, serverContext } from '@/lib/api'
import { orMissing } from '@/lib/store-guard'

export const metadata: Metadata = { title: suppliersContent.heading }

type Props = { params: Promise<{ id: string }> }

export default async function Page({ params }: Props) {
  const { id } = await params
  const context = await serverContext()
  const supplier = await call(appRouter.suppliers.get, { id }, { context }).catch(
    (err: unknown) => {
      if (err instanceof ORPCError && err.code === 'NOT_FOUND') notFound()
      // A malformed id in the address is "Page not found" too.
      if (orMissing(err) === null) notFound()
      throw err
    },
  )

  // Keyed on updatedAt so a refresh after saving remounts the form with fresh values.
  return <SupplierForm key={new Date(supplier.updatedAt).toISOString()} supplier={supplier} />
}
