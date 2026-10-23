'use client'

import { CircleCheck, Unlink } from '@commerce/ui/icons'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type CommissionRowActionsProps = {
  id: string
  status: string
  flag: string | null
  paid: boolean
  onChanged: () => void
}

/** Allow a commission held as the affiliate's own order, or reverse one by hand. */
export default function CommissionRowActions({
  id,
  status,
  flag,
  paid,
  onChanged,
}: CommissionRowActionsProps) {
  // Hooks
  const { commissions: copy, failed } = useCopy(affiliatesContent)

  // Helpers
  const decide = async (decision: 'clear' | 'reverse') => {
    try {
      await api.affiliates.commissions.decide({ id, decision })
      toast.success(decision === 'clear' ? copy.cleared : copy.reversed)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failed)
    }
  }

  // Early returns
  if (paid || (status === 'reversed' && !flag)) return null

  // Render logic
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: only stops the row's own click; the controls inside are buttons.
    // biome-ignore lint/a11y/useKeyWithClickEvents: same, keyboard events stop at the trigger.
    <span className="flex items-center justify-end" onClick={(event) => event.stopPropagation()}>
      <ActionMenu
        label={copy.menu}
        contentClassName="w-64"
        items={[
          { label: copy.clear, icon: CircleCheck, hidden: !flag, onSelect: () => decide('clear') },
          {
            label: copy.reverse,
            icon: Unlink,
            hidden: status === 'reversed',
            destructive: true,
            onSelect: () => decide('reverse'),
          },
        ]}
      />
    </span>
  )
}
