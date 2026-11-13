import type { bulkShipContent } from '@/data/bulk-ship'
import type { createShipmentContent } from '@/data/create-shipment'
import type { BulkProblem } from './bulk-ship-state'

/** What a problem row says and the label of the button that fixes it (null: none here). */
export function problemText(
  problem: BulkProblem,
  copy: typeof bulkShipContent,
  blocked: typeof createShipmentContent.bulkPackage.blocked,
): { text: string; fix: string | null } {
  switch (problem.kind) {
    case 'blocked':
      return { text: blocked[problem.reason], fix: null }
    case 'needs_package':
      return { text: copy.problem.needsPackage(problem.box), fix: copy.fix.addWeight }
    case 'no_cod':
      return { text: copy.problem.noCod, fix: copy.fix.payOnline }
    case 'no_courier':
      return { text: copy.problem.noCourier, fix: copy.fix.change }
    case 'not_this_courier':
      return { text: copy.problem.notThisCourier, fix: copy.fix.change }
    case 'checkout_route':
      return { text: copy.problem.checkoutRoute(problem.route), fix: copy.fix.change }
  }
}
