/**
 * SPIKE shim for `next/navigation` on TanStack Router. Covers what the Orders page and the
 * admin shell call: useRouter (push, replace, refresh, back, forward, prefetch), usePathname,
 * useSearchParams, useParams, redirect and notFound.
 */
import {
  notFound as tsNotFound,
  redirect as tsRedirect,
  useLocation,
  useParams as useTsParams,
  useRouter as useTsRouter,
} from '@tanstack/react-router'
import { useMemo } from 'react'
import { queryClient } from '~/query'

export function useRouter() {
  const router = useTsRouter()
  return useMemo(
    () => ({
      push: (href: string) => router.navigate({ href }),
      replace: (href: string) => router.navigate({ href, replace: true }),
      back: () => router.history.back(),
      forward: () => router.history.forward(),
      // Next's refresh re-runs the server components; here the data lives in TanStack Query,
      // so refresh means "every query is stale, fetch the visible ones again".
      refresh: () => {
        void queryClient.invalidateQueries()
        void router.invalidate()
      },
      prefetch: (href: string) => {
        void router.preloadRoute({ href } as never).catch(() => undefined)
      },
    }),
    [router],
  )
}

export function usePathname(): string {
  return useLocation({ select: (l) => l.pathname })
}

export function useSearchParams(): URLSearchParams {
  const searchStr = useLocation({ select: (l) => l.searchStr })
  return useMemo(() => new URLSearchParams(searchStr), [searchStr])
}

export function useParams<T extends Record<string, string>>(): T {
  return useTsParams({ strict: false } as never) as T
}

export function redirect(href: string): never {
  throw tsRedirect({ href })
}
export const permanentRedirect = redirect

export function notFound(): never {
  throw tsNotFound()
}
