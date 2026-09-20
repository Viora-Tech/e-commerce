import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { appRouter, call, serverContext } from '@/lib/api'
import { formatPaise } from '@/lib/money'

type Search = { page?: string; q?: string; status?: string }
const PER_PAGE = 25
const statuses = ['draft', 'active', 'archived'] as const
type Status = (typeof statuses)[number]

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page ?? 1) || 1)
  const status = statuses.find((s) => s === sp.status) as Status | undefined
  const context = await serverContext()
  const result = await call(
    appRouter.products.list,
    { page, perPage: PER_PAGE, search: sp.q || undefined, status },
    { context },
  ).catch(() => null)
  if (!result) redirect('/select-store')
  const totalPages = Math.max(1, Math.ceil(result.total / PER_PAGE))

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">{result.total} in this store</p>
        </div>
        <Button disabled>Add product</Button>
      </div>

      <form className="flex flex-wrap gap-2">
        <Input
          name="q"
          placeholder="Search titles"
          defaultValue={sp.q ?? ''}
          className="max-w-xs"
        />
        <select
          name="status"
          defaultValue={status ?? ''}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Any status</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2 text-right">Variants</th>
              <th className="px-3 py-2 text-right">Available</th>
              <th className="px-3 py-2 text-right">From</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {result.items.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="px-3 py-2">
                  <Link href={`/products/${p.id}`} className="flex items-center gap-3">
                    {p.imageUrl ? (
                      // biome-ignore lint/performance/noImgElement: thumbnails from the CDN, no layout shift risk at 40px.
                      <img
                        src={p.imageUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="size-10 rounded object-cover"
                      />
                    ) : (
                      <span className="size-10 rounded bg-muted" />
                    )}
                    <span className="font-medium">{p.title}</span>
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <Badge variant={p.status === 'active' ? 'default' : 'secondary'}>
                    {p.status}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{p.productType ?? '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.variantCount}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.available}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {p.minPricePaise != null ? formatPaise(p.minPricePaise) : '—'}
                </td>
              </tr>
            ))}
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                  No products match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" disabled={page <= 1}>
            <Link href={`?${new URLSearchParams({ ...sp, page: String(page - 1) })}`}>
              Previous
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
            <Link href={`?${new URLSearchParams({ ...sp, page: String(page + 1) })}`}>Next</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
