import { config } from 'zod'
import { installClientErrorBuffer } from '@/lib/client-errors'

/**
 * Runs in the browser before the app hydrates. Zod's object parser probes for `new Function`
 * the first time it runs; under the nonce script CSP (`lib/csp.ts`, no `'unsafe-eval'`) the
 * caught probe still files a `securitypolicyviolation`. `jitless` skips the probe; parsing is
 * unchanged.
 */
config({ jitless: true })

/* "Report a bug" sends the tab's recent errors; start remembering them from page load. */
installClientErrorBuffer()
