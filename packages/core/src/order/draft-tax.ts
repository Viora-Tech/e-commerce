/** SOURCE OF TRUTH: previewDraftGst — WHAT: the "GST (estimated)" line on the draft editor, from the lines as typed (not yet saved) / WHY: the merchant sees the tax inside the bill before converting; converting bills each line at the same rate (resolveLines snapshots it) */
import { store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { StoreAddressSchema } from '../settings/general'
import { type DraftGstEstimate, estimateDraftGst } from '../tax/draft-gst'
import { parseStoreTax } from '../tax/settings'
import { type DraftInput, resolveLines } from './drafts'

export async function previewDraftGst(
  ctx: StoreContext,
  input: {
    lines: DraftInput['lines']
    totalPaise: number
    reductionPaise: number
    stateCode: string | null
  },
): Promise<DraftGstEstimate> {
  const [s] = await ctx.tx
    .select({ address: store.address, gstRatePercent: store.gstRatePercent, apps: store.apps })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  const lines = await resolveLines(ctx, input.lines)
  const storeAddress = StoreAddressSchema.safeParse(s?.address ?? {})
  return estimateDraftGst({
    lines: lines.map((l) => ({
      grossPaise: l.quantity * l.unitPricePaise,
      ratePercent: l.gstRatePercent,
      // An untaxed variant already carries rate 0 from resolveLines.
      taxable: true,
      giftCard: l.giftCard,
    })),
    storeRatePercent: s?.gstRatePercent ?? 18,
    tax: parseStoreTax(s?.apps),
    totalPaise: input.totalPaise,
    reductionPaise: input.reductionPaise,
    shipToState: input.stateCode,
    storeState: storeAddress.success ? storeAddress.data.state : null,
  })
}
