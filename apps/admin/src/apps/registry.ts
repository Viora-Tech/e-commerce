import {
  Blocks,
  Download,
  FileBarChart,
  FileText,
  Inbox,
  type LucideIcon,
  Puzzle,
  Settings,
  Store,
  Upload,
} from '@commerce/ui/icons'
import type { ComponentType } from 'react'
import InvoiceDetail from '@/components/apps/gst-invoices/invoice-detail'
import InvoicesList from '@/components/apps/gst-invoices/invoices-list'
import GstOrderCard from '@/components/apps/gst-invoices/order-card'
import QueuePage from '@/components/apps/gst-invoices/queue-page'
import ReturnsPage from '@/components/apps/gst-invoices/returns-page'
import GstSettingsEditor from '@/components/apps/gst-invoices/settings-editor'
import ConnectPage from '@/components/apps/shopify-import/connect-page'
import CsvPage from '@/components/apps/shopify-import/csv-page'
import ImportsPage from '@/components/apps/shopify-import/imports-page'
import RunPage from '@/components/apps/shopify-import/run-page'

/** What a page of an app receives: the dynamic segments of its path, e.g. `{ id }`. */
export type AppPageProps = { params: Record<string, string> }

/**
 * Admin screens contributed by installed apps, keyed by plugin id. The
 * manifest (server) declares the pages (`admin.pages`) and the order card;
 * the components live here so server code never imports React. Pages render
 * under `/apps/<pluginId>/<path>` inside the app shell, only for stores that
 * installed the app.
 */
export type AdminApp = {
  /** Keyed by the manifest page path, e.g. `''`, `'settings'`, `'invoices/[id]'`. */
  pages: Record<string, ComponentType<AppPageProps>>
  OrderCard?: ComponentType<{ orderId: string }>
}

export const ADMIN_APPS: Record<string, AdminApp> = {
  'gst-invoices': {
    pages: {
      '': QueuePage,
      invoices: InvoicesList,
      'invoices/[id]': InvoiceDetail,
      reports: ReturnsPage,
      settings: GstSettingsEditor,
    },
    OrderCard: GstOrderCard,
  },
  'shopify-import': {
    pages: {
      '': ImportsPage,
      csv: CsvPage,
      connect: ConnectPage,
      'runs/[id]': RunPage,
    },
  },
}

/** Icon names a manifest may use, mapped to the admin icon set. */
const ICONS: Record<string, LucideIcon> = {
  Blocks,
  Download,
  FileBarChart,
  FileText,
  Inbox,
  Puzzle,
  Settings,
  Store,
  Upload,
}

export const appIcon = (name: string | null | undefined): LucideIcon =>
  (name ? ICONS[name] : undefined) ?? Puzzle

/**
 * The manifest page matching a path under the app root, with its params:
 * `invoices/abc` matches `invoices/[id]` with `{ id: 'abc' }`.
 */
export function matchAppPage<T extends { path: string }>(
  pages: readonly T[],
  segments: readonly string[],
): { page: T; params: Record<string, string> } | null {
  for (const page of pages) {
    const pattern = page.path === '' ? [] : page.path.split('/')
    if (pattern.length !== segments.length) continue
    const params: Record<string, string> = {}
    const ok = pattern.every((part, i) => {
      const seg = segments[i] ?? ''
      const dyn = /^\[(\w+)\]$/.exec(part)
      if (dyn?.[1]) {
        params[dyn[1]] = seg
        return true
      }
      return part === seg
    })
    if (ok) return { page, params }
  }
  return null
}
