'use client'

import type { returnActions } from '@commerce/core/returns'
import { CancelCircle, CheckIcon, PackageCheck, PackageOpen, Truck, Undo } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import NextStepBanner from '@/components/layout/next-step-banner'
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

/**
 * Figma "Return · Your decision": the banner above the columns with the one next step before
 * the parcel arrives (approve or decline, arrange the pickup, mark it received).
 */
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

  // Render logic
  const d = copy.decision
  const deciding = can.approve || can.reject
  const banner = deciding
    ? { eyebrow: d.title, title: d.heading, body: d.body, icon: <Undo aria-hidden="true" /> }
    : can.arrangePickup
      ? {
          eyebrow: d.nextEyebrow,
          title: d.pickupHeading,
          body: d.pickupBody,
          icon: <Truck aria-hidden="true" />,
        }
      : {
          eyebrow: d.nextEyebrow,
          title: d.receiveHeading,
          body: d.receiveBody,
          icon: <PackageOpen aria-hidden="true" />,
        }

  return (
    <>
      <NextStepBanner
        tone={deciding ? 'attention' : 'action'}
        eyebrow={banner.eyebrow}
        title={banner.title}
        body={banner.body}
        icon={banner.icon}
        actions={
          <>
            {can.reject ? (
              <Button variant="outline" onClick={() => setRejecting(true)}>
                <CancelCircle aria-hidden="true" />
                {d.reject}
              </Button>
            ) : null}
            {can.arrangePickup ? (
              <Button variant="outline" onClick={() => setPickup('arrange')}>
                <Truck aria-hidden="true" />
                {copy.arrange}
              </Button>
            ) : null}
            {can.approve ? (
              <Button onClick={() => setPickup('approve')}>
                <CheckIcon aria-hidden="true" />
                {d.approve}
              </Button>
            ) : null}
            {can.receive ? (
              <Button onClick={() => setReceiving(true)}>
                <PackageCheck aria-hidden="true" />
                {copy.receive.button}
              </Button>
            ) : null}
          </>
        }
      />
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
    </>
  )
}
