import { INBOX_APP_ID } from '@commerce/core/inbox'
import { MessageSquare } from '@commerce/ui/icons'
import SectionEmpty from '@/components/layout/section-empty'
import { inboxContent } from '@/data/inbox'
import { getCopy } from '@/lib/copy-server'
import { routes } from '@/lib/routes'

/** What an Inbox page shows while the app is not installed: a link to install it (free). */
export default async function NotInstalled() {
  const copy = await getCopy(inboxContent.notInstalled)
  return (
    <SectionEmpty
      heading={copy.heading}
      body={copy.body}
      action={{ label: copy.action, href: routes.apps.page(INBOX_APP_ID) }}
      icon={MessageSquare}
    />
  )
}
