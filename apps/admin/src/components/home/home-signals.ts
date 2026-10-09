/** The few facts about the store's apps that Home's set-up cards and suggestions read. */
export type HomeSignals = {
  /** Name of the first connected payment gateway; null when none is connected. */
  payments: string | null
  /** Name of the first connected courier; null when none is connected. */
  shipping: string | null
  reviewsInstalled: boolean
  whatsappConnected: boolean
}

/** Just the part of an app listing row we read (`apps.list`). */
export type HomeAppRow = {
  id: string
  name: string
  installed: boolean
  connected: boolean
  provides: { payments: unknown[]; shipping: unknown[] }
}

/** Boils the app list down to {@link HomeSignals}. */
export function homeSignals(apps: HomeAppRow[]): HomeSignals {
  const firstConnected = (kind: 'payments' | 'shipping') =>
    apps.find((a) => a.connected && a.provides[kind].length > 0)?.name ?? null
  return {
    payments: firstConnected('payments'),
    shipping: firstConnected('shipping'),
    reviewsInstalled: apps.some((a) => a.id === 'reviews' && a.installed),
    whatsappConnected: apps.some((a) => a.id === 'whatsapp' && a.connected),
  }
}
