import ReadFailedPage from '@/components/sales-channels/read-failed-page'
import type { ReadFailure } from '@/components/sales-channels/server-read'
import { inboxContent } from '@/data/inbox'
import { getCopy } from '@/lib/copy-server'

type InboxReadFailedProps = { failure: ReadFailure }

/** An Inbox page whose server read failed: "Could not load the inbox" with Try again, or no access. */
export default async function InboxReadFailed({ failure }: InboxReadFailedProps) {
  const copy = await getCopy(inboxContent)
  return <ReadFailedPage failure={failure} heading={copy.loadFailed} />
}
