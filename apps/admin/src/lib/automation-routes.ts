/** Admin paths inside the Automations app (`/apps/automations/...`), shared by its pages and record cards. */
import { routes } from '@/lib/routes'

const APP = 'automations'

export const automationRoutes = {
  workflows: () => routes.apps.page(APP),
  workflow: (id: string) => routes.apps.page(APP, 'workflows', id),
  templates: () => routes.apps.page(APP, 'templates'),
  runs: () => routes.apps.page(APP, 'runs'),
  /** The runs list filtered to one workflow. */
  workflowRuns: (workflowId: string) =>
    `${routes.apps.page(APP, 'runs')}?workflow=${encodeURIComponent(workflowId)}`,
  run: (id: string) => routes.apps.page(APP, 'runs', id),
  approvals: () => routes.apps.page(APP, 'approvals'),
  settings: () => routes.apps.page(APP, 'settings'),
}

/** Where a run's record opens in the admin, when it is one the admin has a page for. */
export function recordHref(type: string, id: string | null): string | null {
  if (!id) return null
  if (type === 'order') return routes.orders.detail(id)
  if (type === 'customer') return routes.customers.detail(id)
  if (type === 'product') return routes.products.detail(id)
  return null
}
