import type { ComponentType } from 'react'
import AffiliateDetail from '@/components/apps/affiliates/affiliate-detail'
import AffiliatesList from '@/components/apps/affiliates/affiliates-list'
import CommissionsList from '@/components/apps/affiliates/commissions-list'
import AffiliateCreatives from '@/components/apps/affiliates/creatives-page'
import AffiliatesOverview from '@/components/apps/affiliates/overview-page'
import AffiliatePayouts from '@/components/apps/affiliates/payouts-page'
import AffiliateProgramEditor from '@/components/apps/affiliates/program-editor'
import AffiliatePrograms from '@/components/apps/affiliates/programs-page'
import AffiliateSettings from '@/components/apps/affiliates/settings-page'
import AutomationApprovalsPage from '@/components/apps/automations/approvals-page'
import AutomationRunPage from '@/components/apps/automations/run-page'
import AutomationRunsPage from '@/components/apps/automations/runs-page'
import AutomationSettingsPage from '@/components/apps/automations/settings-page'
import AutomationTemplatesPage from '@/components/apps/automations/templates-page'
import AutomationWorkflowPage from '@/components/apps/automations/workflow-page'
import AutomationWorkflowsPage from '@/components/apps/automations/workflows-page'
import OverviewPage from '@/components/apps/back-in-stock/overview-page'
import SettingsEditorBackInStock from '@/components/apps/back-in-stock/settings-editor'
import SignupsList from '@/components/apps/back-in-stock/signups-list'
import BluedartConnectPage from '@/components/apps/bluedart/connect-page'
import BluedartOverviewPage from '@/components/apps/bluedart/overview-page'
import CashfreeConnectPage from '@/components/apps/cashfree/connect-page'
import CashfreeOverviewPage from '@/components/apps/cashfree/overview-page'
import ChatwootCustomerCard from '@/components/apps/chatwoot/customer-card'
import ChatwootOrderCard from '@/components/apps/chatwoot/order-card'
import ChatwootSettingsPage from '@/components/apps/chatwoot/settings-page'
import CodRtoOrderCard from '@/components/apps/cod-rto/order-card'
import CodRtoOverviewPage from '@/components/apps/cod-rto/overview-page'
import CodRtoReturnReasonsPage from '@/components/apps/cod-rto/return-reasons-page'
import CodRtoRiskyOrdersPage from '@/components/apps/cod-rto/risky-orders-page'
import CodRtoSettingsPage from '@/components/apps/cod-rto/settings-page'
import DecentroConnectPage from '@/components/apps/decentro/connect-page'
import DecentroOverviewPage from '@/components/apps/decentro/overview-page'
import DelhiveryConnectPage from '@/components/apps/delhivery/connect-page'
import DelhiveryOverviewPage from '@/components/apps/delhivery/overview-page'
import DeliveryOptionPage from '@/components/apps/delivery-options/option-page'
import DeliveryOptionsOverviewPage from '@/components/apps/delivery-options/overview-page'
import DhlExpressConnectPage from '@/components/apps/dhl-express/connect-page'
import DhlExpressOverviewPage from '@/components/apps/dhl-express/overview-page'
import DtdcConnectPage from '@/components/apps/dtdc/connect-page'
import DtdcOverviewPage from '@/components/apps/dtdc/overview-page'
import EkartConnectPage from '@/components/apps/ekart/connect-page'
import EkartOverviewPage from '@/components/apps/ekart/overview-page'
import EmiSettingsPage from '@/components/apps/emi/settings-page'
import FedexConnectPage from '@/components/apps/fedex/connect-page'
import FedexOverviewPage from '@/components/apps/fedex/overview-page'
import SubmissionsList from '@/components/apps/forms/submissions-list'
import GrowthbookExperimentsPage from '@/components/apps/growthbook/experiments-page'
import InvoiceDetail from '@/components/apps/gst-invoices/invoice-detail'
import InvoicesList from '@/components/apps/gst-invoices/invoices-list'
import GstOrderCard from '@/components/apps/gst-invoices/order-card'
import QueuePage from '@/components/apps/gst-invoices/queue-page'
import ReturnsPage from '@/components/apps/gst-invoices/returns-page'
import GstSettingsEditor from '@/components/apps/gst-invoices/settings-editor'
import IndiaPostConnectPage from '@/components/apps/india-post/connect-page'
import IndiaPostLabelPage from '@/components/apps/india-post/label-page'
import IndiaPostOverviewPage from '@/components/apps/india-post/overview-page'
import MeilisearchPage from '@/components/apps/meilisearch/settings-page'
import SesConnectPage from '@/components/apps/messages/ses-connect-page'
import WhatsappConnectPage from '@/components/apps/messages/whatsapp-connect-page'
import PixelEventLogPage from '@/components/apps/pixels/event-log-page'
import PixelsPage from '@/components/apps/pixels/pixels-page'
import RapidshypConnectPage from '@/components/apps/rapidshyp/connect-page'
import RapidshypOverviewPage from '@/components/apps/rapidshyp/overview-page'
import RazorpayConnectPage from '@/components/apps/razorpay/connect-page'
import RazorpayOverviewPage from '@/components/apps/razorpay/overview-page'
import ReviewsImportPage from '@/components/apps/reviews/import-page'
import ReviewsQrPage from '@/components/apps/reviews/qr-page'
import ReviewsQuestionsPage from '@/components/apps/reviews/questions-page'
import ReviewDetail from '@/components/apps/reviews/review-detail'
import ReviewsPage from '@/components/apps/reviews/reviews-page'
import ReviewsSettingsPage from '@/components/apps/reviews/settings-page'
import S3ConnectPage from '@/components/apps/s3/connect-page'
import SearchBoostsPage from '@/components/apps/search/boosts-page'
import SearchFiltersPage from '@/components/apps/search/filters-page'
import SearchOverviewPage from '@/components/apps/search/overview-page'
import SearchRecommendationEditor from '@/components/apps/search/recommendation-editor'
import SearchRecommendationsPage from '@/components/apps/search/recommendations-page'
import SearchSynonymsPage from '@/components/apps/search/synonyms-page'
import SearchConsoleAlmostPageOne from '@/components/apps/search-console/almost-page-one-page'
import SearchConsoleLosingTraffic from '@/components/apps/search-console/losing-traffic-page'
import SearchConsoleOverview from '@/components/apps/search-console/overview-page'
import SearchConsolePages from '@/components/apps/search-console/pages-page'
import SearchConsoleSearches from '@/components/apps/search-console/searches-page'
import SearchConsoleSettings from '@/components/apps/search-console/settings-page'
import SearchConsoleSitemaps from '@/components/apps/search-console/sitemaps-page'
import ShadowfaxConnectPage from '@/components/apps/shadowfax/connect-page'
import ShadowfaxOverviewPage from '@/components/apps/shadowfax/overview-page'
import ShipglobalConnectPage from '@/components/apps/shipglobal/connect-page'
import ShipglobalOverviewPage from '@/components/apps/shipglobal/overview-page'
import ShiprocketConnectPage from '@/components/apps/shiprocket/connect-page'
import ShiprocketOverviewPage from '@/components/apps/shiprocket/overview-page'
import ConnectHeaderButton from '@/components/apps/shopify-import/connect-header-button'
import ConnectPage from '@/components/apps/shopify-import/connect-page'
import CsvPage from '@/components/apps/shopify-import/csv-page'
import ImportsPage from '@/components/apps/shopify-import/imports-page'
import RunPage from '@/components/apps/shopify-import/run-page'
import ShopifySettingsPage from '@/components/apps/shopify-import/settings-page'
import UmamiSettingsPage from '@/components/apps/umami/settings-page'
import XpressbeesConnectPage from '@/components/apps/xpressbees/connect-page'
import XpressbeesOverviewPage from '@/components/apps/xpressbees/overview-page'
import AutomationsCustomerCard from '@/components/automations/records/customer-card'
import AutomationsOrderCard from '@/components/automations/records/order-card'

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
  /**
   * Pages drawn edge to edge without the app header and tabs, for full-screen tools such as
   * the Automations workflow editor (Shopify Flow's editor fills the window too).
   */
  fullPages?: readonly string[]
}

export const ADMIN_APPS: Record<string, AdminApp> = {
  affiliates: {
    pages: {
      '': AffiliatesOverview,
      affiliates: AffiliatesList,
      'affiliates/[id]': AffiliateDetail,
      programs: AffiliatePrograms,
      'programs/[id]': AffiliateProgramEditor,
      commissions: CommissionsList,
      creatives: AffiliateCreatives,
      payouts: AffiliatePayouts,
      settings: AffiliateSettings,
    },
  },
  automations: {
    pages: {
      '': AutomationWorkflowsPage,
      templates: AutomationTemplatesPage,
      runs: AutomationRunsPage,
      approvals: AutomationApprovalsPage,
      settings: AutomationSettingsPage,
      'workflows/[id]': AutomationWorkflowPage,
      'runs/[id]': AutomationRunPage,
    },
    fullPages: ['workflows/[id]'],
    OrderCard: AutomationsOrderCard,
    CustomerCard: AutomationsCustomerCard,
  },
  'back-in-stock': {
    pages: {
      '': OverviewPage,
      signups: SignupsList,
      settings: SettingsEditorBackInStock,
    },
  },
  bluedart: {
    pages: {
      '': BluedartOverviewPage,
      connect: BluedartConnectPage,
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
  'cod-rto': {
    pages: {
      '': CodRtoOverviewPage,
      orders: CodRtoRiskyOrdersPage,
      returns: CodRtoReturnReasonsPage,
      settings: CodRtoSettingsPage,
    },
    OrderCard: CodRtoOrderCard,
  },
  'delivery-options': {
    pages: {
      '': DeliveryOptionsOverviewPage,
      'options/[id]': DeliveryOptionPage,
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
  dtdc: {
    pages: {
      '': DtdcOverviewPage,
      connect: DtdcConnectPage,
    },
  },
  ekart: {
    pages: {
      '': EkartOverviewPage,
      connect: EkartConnectPage,
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
  pixels: {
    pages: {
      '': PixelsPage,
      events: PixelEventLogPage,
    },
  },
  search: {
    pages: {
      '': SearchOverviewPage,
      synonyms: SearchSynonymsPage,
      filters: SearchFiltersPage,
      boosts: SearchBoostsPage,
      recommendations: SearchRecommendationsPage,
      'recommendations/[productId]': SearchRecommendationEditor,
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
  'dhl-express': {
    pages: {
      '': DhlExpressOverviewPage,
      connect: DhlExpressConnectPage,
    },
  },
  fedex: {
    pages: {
      '': FedexOverviewPage,
      connect: FedexConnectPage,
    },
  },
  shipglobal: {
    pages: {
      '': ShipglobalOverviewPage,
      connect: ShipglobalConnectPage,
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
  'india-post': {
    pages: {
      '': IndiaPostOverviewPage,
      connect: IndiaPostConnectPage,
      'labels/[waybill]': IndiaPostLabelPage,
    },
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
      'qr/[target]': ReviewsQrPage,
      questions: ReviewsQuestionsPage,
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
  shadowfax: {
    pages: {
      '': ShadowfaxOverviewPage,
      connect: ShadowfaxConnectPage,
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
  growthbook: {
    pages: { '': GrowthbookExperimentsPage },
  },
  umami: {
    pages: { '': UmamiSettingsPage },
  },
  meilisearch: {
    pages: { '': MeilisearchPage },
  },
  xpressbees: {
    pages: {
      '': XpressbeesOverviewPage,
      connect: XpressbeesConnectPage,
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
