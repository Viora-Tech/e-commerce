'use client'

import type { ReactNode } from 'react'
import SettingsTable, {
  SETTINGS_CELL,
  type SettingsTableColumn,
} from '@/components/settings/settings-table'
import InlineState from '@/components/states/inline-state'
import TableSkeletonRows from '@/components/table/table-skeleton-rows'
import type { LoadFailure } from '@/hooks/use-load'

type InboxTableProps = {
  heading: string
  description?: string
  columns: SettingsTableColumn[]
  /** Adds the trailing row-actions column. */
  actions?: boolean
  /** No answer yet: the real header over placeholder rows. */
  loading: boolean
  /** The read failed: "Could not load …" with Try again under the header. */
  failed: LoadFailure | false
  failedHeading: string
  onRetry: () => void
  /** Under the rows (the empty state). */
  after?: ReactNode
  children?: ReactNode
}

/** The failure row sits on the table's own side inset, under the header. */
const STATE_INSET = 'mx-4 my-4 md:mx-6'

/**
 * The table on an Inbox list (quick replies, knowledge base, blocked senders) in all its states:
 * the same card and header while it loads (placeholder rows), when the read fails (Try again
 * under the header, also after a refresh fails) and once loaded, so nothing jumps.
 */
export default function InboxTable({
  heading,
  description,
  columns,
  actions = false,
  loading,
  failed,
  failedHeading,
  onRetry,
  after,
  children,
}: InboxTableProps) {
  // Render logic
  const failure = failed ? (
    failed === 'no-access' ? (
      <InlineState kind="no-access" className={STATE_INSET} />
    ) : (
      <InlineState kind="error" heading={failedHeading} onRetry={onRetry} className={STATE_INSET} />
    )
  ) : null
  const waiting = loading && !failed

  return (
    <SettingsTable
      heading={heading}
      description={description}
      columns={columns}
      actions={actions}
      after={failure ?? (waiting ? null : after)}
    >
      {failure ? null : waiting ? (
        <TableSkeletonRows
          columns={columns.length + (actions ? 1 : 0)}
          rows={3}
          cellClassName={SETTINGS_CELL}
          label={heading}
        />
      ) : (
        children
      )}
    </SettingsTable>
  )
}
