import ConversationsSkeleton from '@/components/inbox/conversations/conversations-skeleton'
import PageBody from '@/components/layout/page-body'

export default function Loading() {
  return (
    <PageBody>
      <ConversationsSkeleton />
    </PageBody>
  )
}
