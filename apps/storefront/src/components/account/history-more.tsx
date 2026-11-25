import Link from 'next/link'
import { accountContent } from '@/data/account'
import { ACCOUNT_LINK } from '@/lib/account-classes'

type HistoryMoreProps = {
  /** `?show=N` for the next older lines; nothing drawn when null. */
  href: string | null
}

/** "Show older" under a Store credit or Points history: the same page with more lines. */
export default function HistoryMore({ href }: HistoryMoreProps) {
  // Early returns
  if (!href) return null

  return (
    <Link href={href} scroll={false} className={`${ACCOUNT_LINK} self-start`}>
      {accountContent.history.more}
    </Link>
  )
}
