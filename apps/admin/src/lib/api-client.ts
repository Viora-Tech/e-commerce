'use client'

import { createApiClient } from '@commerce/api/client'

// RPCLink needs an absolute URL; resolve against the page origin in the browser.
const base = typeof window === 'undefined' ? 'http://localhost:3200' : window.location.origin
export const api = createApiClient(`${base}/api/rpc`)
