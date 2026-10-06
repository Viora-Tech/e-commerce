import type { ComponentType } from 'react'
import OverviewPage from '@/components/apps/back-in-stock/overview-page'
import SettingsEditorBackInStock from '@/components/apps/back-in-stock/settings-editor'
import SignupsList from '@/components/apps/back-in-stock/signups-list'
import CashfreeConnectPage from '@/components/apps/cashfree/connect-page'
import CashfreeOverviewPage from '@/components/apps/cashfree/overview-page'
import DecentroConnectPage from '@/components/apps/decentro/connect-page'
import DecentroOverviewPage from '@/components/apps/decentro/overview-page'
import DelhiveryConnectPage from '@/components/apps/delhivery/connect-page'
import DelhiveryOverviewPage from '@/components/apps/delhivery/overview-page'
import EmiSettingsPage from '@/components/apps/emi/settings-page'
import SubmissionsList from '@/components/apps/forms/submissions-list'
import InvoiceDetail from '@/components/apps/gst-invoices/invoice-detail'
import InvoicesList from '@/components/apps/gst-invoices/invoices-list'
import GstOrderCard from '@/components/apps/gst-invoices/order-card'
import QueuePage from '@/components/apps/gst-invoices/queue-page'
import ReturnsPage from '@/components/apps/gst-invoices/returns-page'
import GstSettingsEditor from '@/components/apps/gst-invoices/settings-editor'
import SesConnectPage from '@/components/apps/messages/ses-connect-page'
import WhatsappConnectPage from '@/components/apps/messages/whatsapp-connect-page'
import RapidshypConnectPage from '@/components/apps/rapidshyp/connect-page'
import RapidshypOverviewPage from '@/components/apps/rapidshyp/overview-page'
import RazorpayConnectPage from '@/components/apps/razorpay/connect-page'
import RazorpayOverviewPage from '@/components/apps/razorpay/overview-page'
import S3ConnectPage from '@/components/apps/s3/connect-page'
import ShiprocketConnectPage from '@/components/apps/shiprocket/connect-page'
import ShiprocketOverviewPage from '@/components/apps/shiprocket/overview-page'
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
  'back-in-stock': {
    pages: {
      '': OverviewPage,
      signups: SignupsList,
      settings: SettingsEditorBackInStock,
    },
  },
  cashfree: {
    pages: {
      '': CashfreeOverviewPage,
      connect: CashfreeConnectPage,
    },
  },
  decentro: {
    pages: {
      '': DecentroOverviewPage,
      connect: DecentroConnectPage,
    },
  },
  delhivery: {
    pages: {
      '': DelhiveryOverviewPage,
      connect: DelhiveryConnectPage,
    },
  },
  'emi-pay-later': {
    pages: {
      '': EmiSettingsPage,
    },
  },
  forms: {
    pages: {
      '': SubmissionsList,
    },
  },
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
  rapidshyp: {
    pages: {
      '': RapidshypOverviewPage,
      connect: RapidshypConnectPage,
    },
  },
  razorpay: {
    pages: {
      '': RazorpayOverviewPage,
      connect: RazorpayConnectPage,
    },
  },
  s3: {
    pages: {
      '': S3ConnectPage,
    },
  },
  ses: {
    pages: {
      '': SesConnectPage,
      connect: SesConnectPage,
    },
  },
  shiprocket: {
    pages: {
      '': ShiprocketOverviewPage,
      connect: ShiprocketConnectPage,
    },
  },
  whatsapp: {
    pages: {
      '': WhatsappConnectPage,
      connect: WhatsappConnectPage,
    },
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

export { appIcon } from './app-icons'

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
