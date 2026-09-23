'use client'

import { Moon, Package, ShoppingBag, UserRound } from '@commerce/ui/icons'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@commerce/ui/shadcn/command'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { CREATE_LINKS, commandContent, PAGE_LINKS, type PaletteLink } from '@/data/command-palette'
import { navigationContent } from '@/data/navigation'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type OrderHit = { id: string; number: number; customerName: string | null; totalPaise: number }
type ProductHit = { id: string; title: string; status: string }
type CustomerHit = { id: string; name: string; email: string | null }

const LIMIT = 5
const DEBOUNCE_MS = 200

function matches(link: PaletteLink, q: string): boolean {
  if (!q) return true
  const needle = q.toLowerCase()
  return (
    link.label.toLowerCase().includes(needle) ||
    (link.hint?.toLowerCase().includes(needle) ?? false)
  )
}

/** Customers are optional: members without customer access simply get none. */
async function searchCustomers(q: string): Promise<CustomerHit[]> {
  try {
    const r = await api.customers.list({ page: 1, perPage: LIMIT, search: q || undefined })
    return r.items.map((c) => ({ id: c.id, name: c.name ?? c.email ?? '', email: c.email }))
  } catch {
    return []
  }
}

/**
 * The one palette (⌘K or the header search): records from the existing list endpoints
 * (orders, products, customers), then actions (create screens, theme) and every page,
 * filtered by what is typed.
 */
export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  // Hooks
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [query, setQuery] = useState('')
  const [orders, setOrders] = useState<OrderHit[]>([])
  const [products, setProducts] = useState<ProductHit[]>([])
  const [customers, setCustomers] = useState<CustomerHit[]>([])
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
        searchCustomers(q),
      ]).then(([o, p, c]) => {
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
        setCustomers(c)
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

  const handleTheme = () => {
    onOpenChange(false)
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  // Render logic
  const q = query.trim()
  const actions = CREATE_LINKS.filter((l) => matches(l, q))
  const showTheme = matches({ label: commandContent.toggleTheme, href: '', icon: Moon }, q)
  const pages = PAGE_LINKS.filter((l) => matches(l, q))

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title={commandContent.placeholder}>
      <Command shouldFilter={false}>
        <CommandInput value={query} onValueChange={setQuery} placeholder={commandContent.field} />
        <CommandList>
          <CommandEmpty>{commandContent.empty}</CommandEmpty>
          {orders.length > 0 ? (
            <CommandGroup heading={commandContent.orders}>
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
                  <span className="text-muted-foreground tabular-nums">
                    {formatPaise(o.totalPaise)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {products.length > 0 ? (
            <CommandGroup heading={commandContent.products}>
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
          {customers.length > 0 ? (
            <CommandGroup heading={commandContent.customers}>
              {customers.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`customer-${c.id}`}
                  onSelect={() => handleGo(`/customers/${c.id}`)}
                >
                  <UserRound />
                  <span className="flex-1 truncate">{c.name}</span>
                  {c.email && c.email !== c.name ? (
                    <span className="truncate text-xs text-muted-foreground">{c.email}</span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {actions.length > 0 || showTheme ? (
            <CommandGroup heading={commandContent.actions}>
              {actions.map((a) => (
                <CommandItem
                  key={a.href}
                  value={`action-${a.href}`}
                  onSelect={() => handleGo(a.href)}
                >
                  <a.icon />
                  <span className="flex-1 truncate">{a.label}</span>
                </CommandItem>
              ))}
              {showTheme ? (
                <CommandItem value="action-theme" onSelect={handleTheme}>
                  <Moon />
                  <span className="flex-1 truncate">{commandContent.toggleTheme}</span>
                </CommandItem>
              ) : null}
            </CommandGroup>
          ) : null}
          {pages.length > 0 ? (
            <CommandGroup heading={commandContent.pages}>
              {pages.map((p) => (
                <CommandItem
                  key={`${p.href}-${p.label}`}
                  value={`page-${p.href}-${p.label}`}
                  onSelect={() => handleGo(p.href)}
                >
                  <p.icon />
                  <span className="flex-1 truncate">{p.label}</span>
                  {p.hint ? <span className="text-xs text-muted-foreground">{p.hint}</span> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
