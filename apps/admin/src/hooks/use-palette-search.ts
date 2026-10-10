'use client'

import { type Permission, permissions } from '@commerce/core/permissions'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import {
  ALL_LIMIT,
  type CustomerHit,
  type Hits,
  type OrderHit,
  type ProductHit,
  SCOPE_LIMIT,
} from '@/lib/palette-rows'
import type { PaletteScope } from '@/lib/palette-search'

const DEBOUNCE_MS = 150

export type PaletteStatus = 'idle' | 'loading' | 'ready' | 'error'

type Settled = {
  key: string
  failed: boolean
  orders: Hits<OrderHit> | null
  products: Hits<ProductHit> | null
  customers: Hits<CustomerHit> | null
}

export type PaletteSearch = Omit<Settled, 'key' | 'failed'> & {
  status: PaletteStatus
  retry: () => void
}

/** Which record groups a scope asks the server for, given what the member may read. */
function wantedGroups(scope: PaletteScope, can: (p: Permission) => boolean) {
  const all = scope === 'all'
  return {
    orders: (all || scope === 'orders') && can(permissions.ORDERS_READ),
    products: (all || scope === 'products') && can(permissions.PRODUCTS_READ),
    customers: (all || scope === 'customers') && can(permissions.CUSTOMERS_READ),
  }
}

async function fetchOrders(q: string, perPage: number): Promise<Hits<OrderHit>> {
  const r = await api.orders.list({ page: 1, perPage, search: q })
  return {
    total: r.total,
    items: r.items.map((o) => ({
      id: o.id,
      number: o.number,
      customerName: o.customerName ?? o.email,
      status: o.status,
      totalPaise: o.totalPaise,
      placedAt: o.placedAt,
      imageUrl: o.firstLineImage,
    })),
  }
}

async function fetchProducts(q: string, perPage: number): Promise<Hits<ProductHit>> {
  const r = await api.products.list({ page: 1, perPage, search: q })
  return {
    total: r.total,
    items: r.items.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      imageUrl: p.imageUrl,
      minPricePaise: p.minPricePaise,
      maxPricePaise: p.maxPricePaise,
      available: p.available,
    })),
  }
}

async function fetchCustomers(q: string, perPage: number): Promise<Hits<CustomerHit>> {
  const r = await api.customers.list({ page: 1, perPage, search: q })
  return {
    total: r.total,
    items: r.items.map((c) => ({
      id: c.id,
      name: c.name ?? c.email ?? '',
      email: c.email,
      phone: c.phone,
      orderCount: c.orderCount,
    })),
  }
}

/**
 * The record groups for what is typed: debounced 150 ms, one request per group the scope and the
 * member's permissions allow. A newer search always wins: an older answer arriving late is
 * dropped. While the inputs and the settled answer disagree the status is `loading`, which
 * needs no extra state set inside the effect.
 */
export function usePaletteSearch(
  query: string,
  scope: PaletteScope,
  can: (p: Permission) => boolean,
): PaletteSearch {
  // Hooks
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState<Settled | null>(null)
  const wanted = wantedGroups(scope, can)
  const remote = query.length > 0 && (wanted.orders || wanted.products || wanted.customers)
  const key = `${scope}|${query}|${attempt}|${wanted.orders}${wanted.products}${wanted.customers}`

  useEffect(() => {
    if (!remote) return
    let cancelled = false
    const perPage = scope === 'all' ? ALL_LIMIT : SCOPE_LIMIT
    const timer = setTimeout(() => {
      const empty = Promise.resolve(null)
      Promise.allSettled([
        wanted.orders ? fetchOrders(query, perPage) : empty,
        wanted.products ? fetchProducts(query, perPage) : empty,
        wanted.customers ? fetchCustomers(query, perPage) : empty,
      ]).then(([orders, products, customers]) => {
        if (cancelled) return
        const results = [orders, products, customers]
        const asked = results.filter((r) => r.status !== 'fulfilled' || r.value !== null)
        setSettled({
          key,
          failed: asked.length > 0 && asked.every((r) => r.status === 'rejected'),
          orders: orders.status === 'fulfilled' ? (orders.value as Hits<OrderHit> | null) : null,
          products:
            products.status === 'fulfilled' ? (products.value as Hits<ProductHit> | null) : null,
          customers:
            customers.status === 'fulfilled' ? (customers.value as Hits<CustomerHit> | null) : null,
        })
      })
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [key, remote, query, scope, wanted.orders, wanted.products, wanted.customers])

  // Helpers
  const retry = () => setAttempt((n) => n + 1)

  // Render logic
  const current = remote && settled?.key === key ? settled : null
  const status: PaletteStatus = !remote
    ? query.length > 0
      ? 'ready'
      : 'idle'
    : !current
      ? 'loading'
      : current.failed
        ? 'error'
        : 'ready'

  return {
    status,
    orders: current?.orders ?? null,
    products: current?.products ?? null,
    customers: current?.customers ?? null,
    retry,
  }
}
