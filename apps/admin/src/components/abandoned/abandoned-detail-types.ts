import type { api } from '@/lib/api-client'

export type AbandonedCheckout = Awaited<ReturnType<typeof api.orders.getAbandoned>>
