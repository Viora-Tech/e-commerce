import { cn } from '@commerce/ui/lib/utils'
import { mockAdminContent as copy, type MockTab } from '@/data/mock-admin'

type MockScreenProps = { tab: MockTab }

const ROW =
  'grid items-center gap-2 border-t border-border px-3 py-2 text-xs transition-colors hover:bg-muted/60'

function statusClass(status: string): string {
  if (status === 'Paid' || status === 'Delivered') return 'text-success'
  if (status === 'Shipped') return 'text-foreground'
  return 'text-warning'
}

/** The page body for the active mock tab: stat cards, an orders table or a products table. */
export default function MockScreen({ tab }: MockScreenProps) {
  if (tab === 'home') {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">{copy.home.title}</h3>
        <dl className="grid grid-cols-3 gap-2">
          {copy.home.stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-border bg-card p-2.5">
              <dt className="text-[0.6875rem] text-muted-foreground">{stat.label}</dt>
              <dd className="mt-1 text-base font-semibold text-foreground tabular-nums">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-[0.6875rem] text-muted-foreground">{copy.home.recent}</p>
        <ul className="overflow-hidden rounded-lg border border-border">
          {copy.orders.rows.slice(0, 3).map((row) => (
            <li
              key={row.id}
              className={cn(
                ROW,
                'grid-cols-[3rem_1fr_auto] border-t-0 first:border-t-0 not-first:border-t',
              )}
            >
              <span className="text-muted-foreground">{row.id}</span>
              <span className="text-foreground">{row.name}</span>
              <span className="text-foreground">{row.total}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  if (tab === 'orders') {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">{copy.orders.title}</h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-[3rem_1fr_4rem_6rem] gap-2 px-3 py-2 text-[0.6875rem] text-muted-foreground">
            {copy.orders.columns.map((column) => (
              <span key={column}>{column}</span>
            ))}
          </div>
          {copy.orders.rows.map((row) => (
            <div key={row.id} className={cn(ROW, 'grid-cols-[3rem_1fr_4rem_6rem]')}>
              <span className="text-muted-foreground">{row.id}</span>
              <span className="truncate text-foreground">{row.name}</span>
              <span className="text-foreground">{row.total}</span>
              <span className={statusClass(row.status)}>{row.status}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">{copy.products.title}</h3>
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-[1fr_4rem_4rem] gap-2 px-3 py-2 text-[0.6875rem] text-muted-foreground">
          {copy.products.columns.map((column) => (
            <span key={column}>{column}</span>
          ))}
        </div>
        {copy.products.rows.map((row) => (
          <div key={row.name} className={cn(ROW, 'grid-cols-[1fr_4rem_4rem]')}>
            <span className="truncate text-foreground">{row.name}</span>
            <span className={row.low ? 'text-warning' : 'text-muted-foreground'}>{row.stock}</span>
            <span className="text-foreground">{row.price}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
