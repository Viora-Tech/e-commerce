import type { AppAccess } from '@commerce/core/billing'
import type { AppKind } from '@/data/apps'

/** One app as the admin's apps API returns it: read by the Installed apps list, app pages and the install flow. */
export type AppSummary = {
  id: string
  name: string
  version: string
  description: string | null
  category: string | null
  builtIn: boolean
  /** `builtin`: made by us, no outside account. `connection`: links to another company's service. */
  kind: 'builtin' | 'connection'
  /** The outside company behind a `connection` plugin, e.g. `Cloudflare`. Null for `builtin`. */
  company: string | null
  /** Run end to end on a live store; false shows an "Untested" badge. */
  tested: boolean
  installed: boolean
  /** For a `connection`: installed AND the merchant has saved working credentials for it. */
  connected: boolean
  provides: Record<AppKind, { id: string; label: string }[]>
  /** Lifecycle events the app subscribes to (shown on the permission step). */
  hooks: string[]
  productFields: unknown[]
  admin: { icon: string | null; pages: { path: string; navLabel?: string | undefined }[] }
  /** Open-source projects the app is built on, credited on the card. */
  credits: { name: string; url: string; license: string; note?: string | undefined }[]
  /** What the app declares it can see and do, and what it sends to its outside service. */
  access: {
    resources: { resource: string; level: AccessLevel; why: string }[]
    summary: string | null
    shares: { when: string; what: string }[]
  }
  /** Null when not installed. */
  status: 'connected' | 'needsSetup' | 'error' | null
  /** The recorded failure behind `error`, in words. */
  problem: string | null
  installedAt: string | null
  installedBy: string | null
  lastActivity: string | null
  lastActivityAt: string | null
  /** `flow`: the install flow connects the account first. `page`: it connects on its own page. */
  connectsIn: 'flow' | 'page' | null
  canDisconnect: boolean
  /** Paid apps: free, included in the plan, bought until a date, or to buy. */
  billing: AppAccess
}

export type AccessLevel = 'read' | 'write' | 'read-write'
