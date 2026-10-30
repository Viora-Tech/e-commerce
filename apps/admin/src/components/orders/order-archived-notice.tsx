'use client'

import { Button } from '@commerce/ui/shadcn/button'
import NoticeBar from '@/components/layout/notice-bar'
import { orderDetailContent } from '@/data/order-detail'
import { useCopy, useFormat } from '@/hooks/use-copy'

type OrderArchivedNoticeProps = {
  archivedAt: Date | string
  busy: boolean
  /** Absent when the member cannot change orders. */
  onUnarchive?: (() => void) | undefined
}

/** The strip on an archived order's page (#1007): when, and a button to bring it back. */
export default function OrderArchivedNotice({
  archivedAt,
  busy,
  onUnarchive,
}: OrderArchivedNoticeProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)
  const fmt = useFormat()

  // Render logic
  return (
    <NoticeBar
      action={
        onUnarchive ? (
          <Button variant="outline" size="sm" disabled={busy} onClick={onUnarchive}>
            {copy.archive.unarchive}
          </Button>
        ) : undefined
      }
    >
      <span title={fmt.dateTime(archivedAt)}>{copy.archive.notice(fmt.ago(archivedAt))}</span>
    </NoticeBar>
  )
}
