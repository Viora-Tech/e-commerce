'use client'

import type { returnActions } from '@commerce/core/returns'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import { returnDetailContent as copy } from '@/data/returns'
import PickupDialog from './pickup-dialog'
import ReceiveDialog from './receive-dialog'
import RejectDialog from './reject-dialog'
import type { ReturnDetail } from './return-types'

type ReturnDecisionCardProps = {
  detail: ReturnDetail
  can: ReturnType<typeof returnActions>
  onChanged: () => void
}

/** The next step before the parcel arrives: approve or decline, arrange the pickup, receive. */
export default function ReturnDecisionCard({ detail, can, onChanged }: ReturnDecisionCardProps) {
  // Hooks
  const [pickup, setPickup] = useState<'approve' | 'arrange' | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [receiving, setReceiving] = useState(false)

  // Helpers
  const done = (close: () => void) => () => {
    close()
    onChanged()
  }

  return (
    <DataCard title={copy.decision.title}>
      {can.approve ? (
        <p className="mb-4 text-body text-muted-foreground">{copy.decision.body}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {can.approve ? (
          <Button size="lg" onClick={() => setPickup('approve')}>
            {copy.decision.approve}
          </Button>
        ) : null}
        {can.arrangePickup ? (
          <Button size="lg" variant="outline" onClick={() => setPickup('arrange')}>
            {copy.arrange}
          </Button>
        ) : null}
        {can.receive ? (
          <Button size="lg" onClick={() => setReceiving(true)}>
            {copy.receive.button}
          </Button>
        ) : null}
        {can.reject ? (
          <Button size="lg" variant="outline" onClick={() => setRejecting(true)}>
            {copy.decision.reject}
          </Button>
        ) : null}
      </div>
      <PickupDialog
        detail={detail}
        mode={pickup}
        onClose={() => setPickup(null)}
        onDone={done(() => setPickup(null))}
      />
      <RejectDialog
        returnId={detail.id}
        open={rejecting}
        onClose={() => setRejecting(false)}
        onDone={done(() => setRejecting(false))}
      />
      <ReceiveDialog
        returnId={detail.id}
        open={receiving}
        restockByDefault={detail.policy.restockAutomatically}
        onClose={() => setReceiving(false)}
        onDone={done(() => setReceiving(false))}
      />
    </DataCard>
  )
}
