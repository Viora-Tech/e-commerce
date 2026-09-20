import type { api } from '@/lib/api-client'

export type ProductListItem = Awaited<ReturnType<typeof api.products.list>>['items'][number]
