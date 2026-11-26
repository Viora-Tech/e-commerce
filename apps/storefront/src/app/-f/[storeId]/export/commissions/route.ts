import { portalCommissionsCsv } from '@commerce/plugin-affiliates/server'
import type { NextRequest } from 'next/server'
import { commissionFilters, loadCommissions } from '@/lib/portal-data'
import { csvResponse, exportingAffiliate, notFoundResponse } from '@/lib/portal-export'

type Params = { params: Promise<{ storeId: string }> }

/** The Commission page's Export: their commissions with the page's filters, up to 1,000 rows. */
export async function GET(request: NextRequest, { params }: Params) {
  const { storeId } = await params
  const affiliate = await exportingAffiliate(storeId)
  if (!affiliate) return notFoundResponse()
  const filters = commissionFilters(Object.fromEntries(request.nextUrl.searchParams))
  const rows = await loadCommissions(storeId, affiliate.id, { ...filters, limit: 1000 })
  return csvResponse(portalCommissionsCsv(rows), `commissions-${affiliate.code}.csv`)
}
