import type { ComponentType } from 'react'
import OverviewPage from '@/components/apps/back-in-stock/overview-page'
import SettingsEditorBackInStock from '@/components/apps/back-in-stock/settings-editor'
import SignupsList from '@/components/apps/back-in-stock/signups-list'
import CashfreeConnectPage from '@/components/apps/cashfree/connect-page'
import CashfreeOverviewPage from '@/components/apps/cashfree/overview-page'
import ChatwootCustomerCard from '@/components/apps/chatwoot/customer-card'
import ChatwootOrderCard from '@/components/apps/chatwoot/order-card'
import ChatwootSettingsPage from '@/components/apps/chatwoot/settings-page'
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
import ReviewsImportPage from '@/components/apps/reviews/import-page'
import ReviewDetail from '@/components/apps/reviews/review-detail'
import ReviewsPage from '@/components/apps/reviews/reviews-page'
import ReviewsSettingsPage from '@/components/apps/reviews/settings-page'
import S3ConnectPage from '@/components/apps/s3/connect-page'
import SearchConsoleAlmostPageOne from '@/components/apps/search-console/almost-page-one-page'
import SearchConsoleLosingTraffic from '@/components/apps/search-console/losing-traffic-page'
import SearchConsoleOverview from '@/components/apps/search-console/overview-page'
import SearchConsolePages from '@/components/apps/search-console/pages-page'
import SearchConsoleSearches from '@/components/apps/search-console/searches-page'
import SearchConsoleSettings from '@/components/apps/search-console/settings-page'
import SearchConsoleSitemaps from '@/components/apps/search-console/sitemaps-page'
import ShiprocketConnectPage from '@/components/apps/shiprocket/connect-page'
import ShiprocketOverviewPage from '@/components/apps/shiprocket/overview-page'
import ConnectHeaderButton from '@/components/apps/shopify-import/connect-header-button'
import ConnectPage from '@/components/apps/shopify-import/connect-page'
import CsvPage from '@/components/apps/shopify-import/csv-page'
import ImportsPage from '@/components/apps/shopify-import/imports-page'
import RunPage from '@/components/apps/shopify-import/run-page'
import ShopifySettingsPage from '@/components/apps/shopify-import/settings-page'
import UmamiSettingsPage from '@/components/apps/umami/settings-page'

/** What a page of an app receives: the dynamic segments of its path, e.g. `{ id }`. */
export type AppPageProps = { params: Record<string, string> }

/**
 * Admin screens contributed by installed apps, keyed by plugin id. The
 * manifest (server) declares the pages (`admin.pages`) and the order and customer cards;
 * the components live here so server code never imports React. Pages render
 * under `/apps/<pluginId>/<path>` inside the app shell, only for stores that
 * installed the app.
 */
export type AdminApp = {
  /** Keyed by the manifest page path, e.g. `''`, `'settings'`, `'invoices/[id]'`. */
  pages: Record<string, ComponentType<AppPageProps>>
  OrderCard?: ComponentType<{ orderId: string }>
  /** A card on the customer detail page (manifest `admin.customerDetailCard`). */
  CustomerCard?: ComponentType<{ customerId: string }>
  /** A button in the app header beside the more menu, on every tab. */
  HeaderAction?: ComponentType
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
  chatwoot: {
    pages: { '': ChatwootSettingsPage },
    OrderCard: ChatwootOrderCard,
    CustomerCard: ChatwootCustomerCard,
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
  'google-search-console': {
    pages: {
      '': SearchConsoleOverview,
      searches: SearchConsoleSearches,
      pages: SearchConsolePages,
      'almost-page-one': SearchConsoleAlmostPageOne,
      'losing-traffic': SearchConsoleLosingTraffic,
      sitemaps: SearchConsoleSitemaps,
      settings: SearchConsoleSettings,
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
  reviews: {
    pages: {
      '': ReviewsPage,
      import: ReviewsImportPage,
      settings: ReviewsSettingsPage,
      'reviews/[id]': ReviewDetail,
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
    HeaderAction: ConnectHeaderButton,
    pages: {
      '': ImportsPage,
      csv: CsvPage,
      connect: ConnectPage,
      settings: ShopifySettingsPage,
      'runs/[id]': RunPage,
    },
  },
  umami: {
    pages: { '': UmamiSettingsPage },
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
