'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { staffContent } from '@/data/staff'
import { useCopy } from '@/hooks/use-copy'
import type { LevelCounts } from './role-access'
import RoleLevelSummary from './role-level-summary'

type RoleSummaryBarProps = {
  counts: LevelCounts
  showAsk: boolean
  /** Leave out on a role the member can only look at: the bar then only counts. */
  save?: { dirty: boolean; saving: boolean; onSave: () => void } | undefined
}

/**
 * The role page's bar, stuck to the bottom of the screen while the tables scroll: how many
 * permissions are allowed, ask first and off, and the one Save for the whole role.
 */
export default function RoleSummaryBar({ counts, showAsk, save }: RoleSummaryBarProps) {
  // Hooks
  const copy = useCopy(staffContent)

  return (
    <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-glass-border glass-bar py-2 pr-2 pl-4 shadow-sm">
      <RoleLevelSummary counts={counts} showAsk={showAsk} />
      {save ? (
        <div className="ml-auto flex items-center gap-3">
          {save.dirty ? (
            <span className="text-caption text-muted-foreground">{copy.roleForm.unsaved}</span>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={!save.dirty}
            loading={save.saving}
            onClick={save.onSave}
          >
            {copy.roleForm.save}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
