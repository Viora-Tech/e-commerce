import { ORPCError } from '@orpc/server'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ShipmentForm from '@/components/inbound-shipments/shipment-form'
import { inboundShipmentsContent } from '@/data/purchasing'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: inboundShipmentsContent.heading }

type Props = { params: Promise<{ id: string }> }

export default async function Page({ params }: Props) {
  const { id } = await params
  const context = await serverContext()
  const shipment = await call(appRouter.inboundShipments.get, { id }, { context }).catch(
    (err: unknown) => {
      if (err instanceof ORPCError && err.code === 'NOT_FOUND') notFound()
      throw err
    },
  )
  const [costs, ai] = await Promise.all([
    call(appRouter.inboundShipments.costs, { id }, { context }),
    call(appRouter.ai.status, undefined, { context }).catch(() => null),
  ])

  // Keyed on updatedAt so a refresh after saving remounts the form with fresh values.
  return (
    <ShipmentForm
      key={new Date(shipment.updatedAt).toISOString()}
      shipment={shipment}
      costs={costs}
      aiReading={ai?.documentReader ?? false}
    />
  )
}
