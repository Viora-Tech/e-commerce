import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { redirect } from 'next/navigation'
import { appRouter, call, serverContext } from '@/lib/api'

export default async function Dashboard() {
  const context = await serverContext()
  const current = await call(appRouter.store.current, undefined, { context }).catch(() => null)
  if (!current) redirect('/select-store')
  const products = await call(appRouter.products.list, { page: 1, perPage: 1 }, { context })

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{current.name}</h1>
        <p className="text-sm text-muted-foreground">You are {current.role} of this store.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Products</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold tabular-nums">
            {products.total}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Orders today
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold tabular-nums">0</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dark mode</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {current.theme.darkMode.enabled ? 'On' : 'Off'}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
