'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { delhiveryAppContent } from '@/data/delhivery'
import { useCopy } from '@/hooks/use-copy'

/** The Delhivery app bar's one action (Figma 928:11256): Recharge wallet on Delhivery One. */
export default function RechargeButton() {
  // Hooks
  const { overview: copy } = useCopy(delhiveryAppContent)

  return (
    <Button
      variant="outline"
      nativeButton={false}
      render={<a href={copy.rechargeUrl} target="_blank" rel="noreferrer" />}
    >
      {copy.rechargeWallet}
    </Button>
  )
}
