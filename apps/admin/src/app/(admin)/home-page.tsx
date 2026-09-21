import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { EmptyState } from '@/components/layout/empty-state'
import { PageBody } from '@/components/layout/page-body'
import { PageHeader } from '@/components/layout/page-header'
import { StatCard } from '@/components/layout/stat-card'
import { OrderStatusBadge } from '@/components/orders/order-badges'
import { homeContent } from '@/data/home'
import type { OrderStatus } from '@/data/orders'
import { ordersContent } from '@/data/orders'
import { formatPaise } from '@/lib/money'

type RecentOrder = {
  id: string
  number: number
  status: OrderStatus
  totalPaise: number
  email: string | null
  customerName: string | null
}

type HomePageProps = {
  storeName: string
  role: string
  productCount: number
  orderCount: number
  revenuePaise: number
  awaitingPayment: number
  recentOrders: RecentOrder[]
  revenueTrend: number[]
}

export function HomePage({
  storeName,
  role,
  productCount,
  orderCount,
  revenuePaise,
  awaitingPayment,
  recentOrders,
  revenueTrend,
}: HomePageProps) {
  return (
    <PageBody>
      <PageHeader title={homeContent.title(storeName)} subtitle={homeContent.subtitle(role)} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={homeContent.stats.revenue}
          value={formatPaise(revenuePaise)}
          trend={revenueTrend}
        />
        <StatCard label={homeContent.stats.orders} value={String(orderCount)} />
        <StatCard label={homeContent.stats.awaitingPayment} value={String(awaitingPayment)} />
        <StatCard label={homeContent.stats.products} value={String(productCount)} />
      </div>
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between border-b py-3">
          <CardTitle>{homeContent.recentOrders}</CardTitle>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/orders" />}>
            {homeContent.viewAll}
            <ArrowRight />
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          {recentOrders.length === 0 ? (
            <EmptyState
              heading={homeContent.emptyOrders.heading}
              body={homeContent.emptyOrders.body}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{homeContent.columns.order}</TableHead>
                  <TableHead>{homeContent.columns.customer}</TableHead>
                  <TableHead className="text-right">{homeContent.columns.total}</TableHead>
                  <TableHead>{homeContent.columns.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">
                      <Link href={`/orders/${o.id}`} className="hover:underline">
                        #{o.number}
                      </Link>
                    </TableCell>
                    <TableCell>{o.customerName ?? o.email ?? ordersContent.guest}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPaise(o.totalPaise)}
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={o.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageBody>
  )
}
