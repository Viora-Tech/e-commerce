'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@commerce/ui/shadcn/tabs'
import PageHeader from '@/components/layout/page-header'
import { shipmentsContent } from '@/data/shipments'
import NdrTab from './ndr-tab'
import PickupsTab from './pickups-tab'
import ShipmentsTab from './shipments-tab'
import WalletCard from './wallet-card'

const copy = shipmentsContent

/** Orders → Shipments: every courier in one place, book/track/label, pickups, NDR, wallet. */
export default function ShipmentsWorkspace() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} subtitle={copy.subtitle} />
      <WalletCard />
      <Tabs defaultValue="shipments">
        <TabsList>
          <TabsTrigger value="shipments">{copy.tabs.shipments}</TabsTrigger>
          <TabsTrigger value="pickups">{copy.tabs.pickups}</TabsTrigger>
          <TabsTrigger value="ndr">{copy.tabs.ndr}</TabsTrigger>
        </TabsList>
        <TabsContent value="shipments">
          <ShipmentsTab />
        </TabsContent>
        <TabsContent value="pickups">
          <PickupsTab />
        </TabsContent>
        <TabsContent value="ndr">
          <NdrTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
