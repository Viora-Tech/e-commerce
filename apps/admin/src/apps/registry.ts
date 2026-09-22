import type { ComponentType } from 'react'
import InvoicesList from '@/components/apps/gst-invoices/invoices-list'
import GstOrderCard from '@/components/apps/gst-invoices/order-card'
import GstSettingsEditor from '@/components/apps/gst-invoices/settings-editor'

/**
 * Admin screens contributed by installed apps, keyed by plugin id. The
 * manifest (server) only declares that a settings page or order card exists;
 * the components live here so server code never imports React. Routes render
 * an entry only when the store has the app installed.
 */
export type AdminApp = {
  SettingsPage?: ComponentType
  OrderCard?: ComponentType<{ orderId: string }>
  /** Extra pages under an existing section, e.g. /orders/invoices. */
  pages?: Record<string, ComponentType>
}

export const ADMIN_APPS: Record<string, AdminApp> = {
  'gst-invoices': {
    SettingsPage: GstSettingsEditor,
    OrderCard: GstOrderCard,
    pages: { '/orders/invoices': InvoicesList },
  },
}
