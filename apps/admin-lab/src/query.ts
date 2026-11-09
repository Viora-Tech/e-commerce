import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { QueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

/**
 * One QueryClient for the app. Data is fresh for 30 s (navigating back paints from cache with
 * no request), and a refocused tab refetches what is on screen, like the admin's
 * refresh-on-focus.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 5 * 60_000, refetchOnWindowFocus: true, retry: 1 },
  },
})

/** The admin's own oRPC client (`@/lib/api-client`, step-up and readable errors included). */
export const orpc = createTanstackQueryUtils(api)
