import { portalPayoutsCsv } from '@commerce/plugin-affiliates/server'
import { loadPayouts } from '@/lib/portal-data'
import { csvResponse, exportingAffiliate, notFoundResponse } from '@/lib/portal-export'

type Params = { params: Promise<{ storeId: string }> }

/** The Payouts page's Export: every payout, with its breakdown. */
export async function GET(_request: Request, { params }: Params) {
  const { storeId } = await params
  const affiliate = await exportingAffiliate(storeId)
  if (!affiliate) return notFoundResponse()
  const rows = await loadPayouts(storeId, affiliate.id, 1000)
  return csvResponse(portalPayoutsCsv(rows), `payouts-${affiliate.code}.csv`)
}
