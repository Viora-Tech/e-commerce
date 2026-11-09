import { createRouter } from '@tanstack/react-router'
import { queryClient } from './query'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    // The SPA shell starts in the pending state; by default the router keeps a pending
    // skeleton up for at least 500 ms, which held the data back (measured, see the spike doc).
    defaultPendingMinMs: 0,
    // Query owns caching; the router only kicks the loaders off.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  })
}
