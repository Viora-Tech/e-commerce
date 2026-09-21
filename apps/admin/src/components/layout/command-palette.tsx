'use client'

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@commerce/ui/shadcn/command'
import { Package, ShoppingBag } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { navigationContent } from '@/data/navigation'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type OrderHit = { id: string; number: number; customerName: string | null; totalPaise: number }
type ProductHit = { id: string; title: string; status: string }

const LIMIT = 5
const DEBOUNCE_MS = 200

/** ⌘K search across orders and products; results come from the existing list endpoints. */
export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  // Hooks
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [orders, setOrders] = useState<OrderHit[]>([])
  const [products, setProducts] = useState<ProductHit[]>([])
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const q = query.trim()
    const handle = setTimeout(() => {
      const byNumber = /^#?\d+$/.test(q)
      Promise.all([
        api.orders.list({
          page: 1,
          perPage: byNumber ? 100 : LIMIT,
          search: byNumber ? undefined : q || undefined,
        }),
        api.products.list({ page: 1, perPage: LIMIT, search: q || undefined }),
      ]).then(([o, p]) => {
        if (cancelled) return
        const n = byNumber ? Number(q.replace('#', '')) : null
        setOrders(
          (n === null ? o.items : o.items.filter((x) => x.number === n))
            .slice(0, LIMIT)
            .map((x) => ({
              id: x.id,
              number: x.number,
              customerName: x.customerName ?? x.email,
              totalPaise: x.totalPaise,
            })),
        )
        setProducts(p.items.map((x) => ({ id: x.id, title: x.title, status: x.status })))
      })
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [open, query])

  // Event handlers
  const handleGo = (href: string) => {
    onOpenChange(false)
    router.push(href)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={navigationContent.search.placeholder}
    >
      <Command shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={navigationContent.search.placeholder}
        />
        <CommandList>
          <CommandEmpty>{navigationContent.search.empty}</CommandEmpty>
          {orders.length > 0 ? (
            <CommandGroup heading={navigationContent.search.orders}>
              {orders.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`order-${o.id}`}
                  onSelect={() => handleGo(`/orders/${o.id}`)}
                >
                  <ShoppingBag />
                  <span className="flex-1 truncate">
                    {navigationContent.search.orderLabel(o.number, o.customerName)}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatPaise(o.totalPaise)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {products.length > 0 ? (
            <CommandGroup heading={navigationContent.search.products}>
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`product-${p.id}`}
                  onSelect={() => handleGo(`/products/${p.id}`)}
                >
                  <Package />
                  <span className="flex-1 truncate">{p.title}</span>
                  <span className="text-xs text-muted-foreground capitalize">{p.status}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
