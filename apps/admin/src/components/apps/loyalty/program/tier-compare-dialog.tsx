'use client'

import { type LoyaltySettings, pointsLabel } from '@commerce/core/loyalty'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import DialogContent from '@/components/layout/dialog-content'
import DialogHeader from '@/components/layout/dialog-header'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { multiplierText, type TierDraft } from '@/lib/loyalty-program'
import { formatPaiseWhole } from '@/lib/money'

type TierCompareDialogProps = {
  open: boolean
  tiers: TierDraft[]
  settings: LoyaltySettings
  onClose: () => void
}

/** Every tier side by side: where it starts, how fast it earns, its perks and tag (unsaved edits too). */
export default function TierCompareDialog({
  open,
  tiers,
  settings,
  onClose,
}: TierCompareDialogProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)
  const locale = useLocale()

  // Helpers
  const at = (t: TierDraft) =>
    settings.tierBasis === 'spend'
      ? formatPaiseWhole(t.threshold, locale)
      : pointsLabel(t.threshold, settings)

  // Render logic
  const c = copy.tiers.compareTable

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent size="wide">
        <div className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{c.title}</DialogTitle>
            <DialogDescription>{c.description}</DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body">
              <thead className="text-caption text-muted-foreground">
                <tr className="border-b border-line">
                  <th className="py-2 pr-4 font-medium">{c.tier}</th>
                  <th className="py-2 pr-4 font-medium">{c.reach}</th>
                  <th className="py-2 pr-4 font-medium">{c.earning}</th>
                  <th className="py-2 pr-4 font-medium">{c.perks}</th>
                  <th className="py-2 font-medium">{c.tag}</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((t) => (
                  <tr key={t.key} className="border-b border-line align-top last:border-0">
                    <td className="py-2.5 pr-4">
                      <span className="flex items-center gap-2 font-medium text-ink-strong">
                        <span
                          aria-hidden
                          className="size-3 rounded-full"
                          style={{ backgroundColor: t.colors.background }}
                        />
                        {t.name.trim() || copy.tiers.unnamed}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums">{at(t)}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{multiplierText(t.multiplierBp)}x</td>
                    <td className="py-2.5 pr-4">
                      {t.perks.length === 0 ? (
                        <span className="text-muted-foreground">{c.none}</span>
                      ) : (
                        <ul className="flex flex-col gap-0.5">
                          {t.perks.map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="py-2.5">
                      {t.customerTag.trim() || (
                        <span className="text-muted-foreground">{c.none}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
