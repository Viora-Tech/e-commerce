'use client'

import PageBody from '@/components/layout/page-body'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'
import { inboxContent } from '@/data/inbox'
import { inboxKnowledgeContent } from '@/data/inbox-knowledge'
import { useCopy } from '@/hooks/use-copy'
import InboxTable from './inbox-table'

type InboxListSkeletonProps = { list: 'knowledge' | 'quickReplies' }

/**
 * The knowledge base or quick replies route while it loads: the page's real title and table
 * header over placeholder rows, the same parts the page draws while its own read runs.
 */
export default function InboxListSkeleton({ list }: InboxListSkeletonProps) {
  // Hooks
  const inbox = useCopy(inboxContent)
  const knowledge = useCopy(inboxKnowledgeContent)

  // Render logic
  const q = inbox.quickReplies
  const table =
    list === 'knowledge'
      ? {
          title: knowledge.title,
          heading: knowledge.listTitle,
          columns: [
            { label: knowledge.columns.title },
            { label: knowledge.columns.answer, className: 'hidden md:table-cell' },
            { label: knowledge.columns.published, center: true },
          ],
        }
      : {
          title: q.title,
          heading: q.listTitle,
          columns: [
            { label: q.columns.shortcut },
            { label: q.columns.title },
            { label: q.columns.body, className: 'hidden md:table-cell' },
          ],
        }

  return (
    <PageBody>
      <PageHeaderSkeleton title={table.title} actions={1} />
      <InboxTable
        heading={table.heading}
        columns={table.columns}
        loading
        failed={false}
        failedHeading=""
        onRetry={() => undefined}
      />
    </PageBody>
  )
}
