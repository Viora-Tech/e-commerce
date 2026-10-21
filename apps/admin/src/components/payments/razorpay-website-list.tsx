import CopyButton from '@/components/fields/copy-button'
import { razorpayWebsitesContent } from '@/data/razorpay-websites'
import { useCopy } from '@/hooks/use-copy'

type RazorpayWebsiteListProps = {
  /** Every address the storefront and checkout are served from (`payments.setup`). */
  websites: string[]
  /** Labels the list, when a heading outside it names it. */
  labelledBy?: string
}

/** The store's web addresses, each with a copy button, to add in Razorpay's dashboard. */
export default function RazorpayWebsiteList({ websites, labelledBy }: RazorpayWebsiteListProps) {
  // Hooks
  const { list: copy } = useCopy(razorpayWebsitesContent)

  // Early returns
  if (websites.length === 0) {
    return <p className="text-body text-muted-foreground">{copy.empty}</p>
  }

  return (
    <ul aria-labelledby={labelledBy} className="flex flex-col gap-1.5">
      {websites.map((host) => (
        <li
          key={host}
          className="flex w-fit max-w-full items-center gap-1 rounded-md border border-border bg-muted py-0.5 pr-1 pl-2"
        >
          <span className="truncate font-mono text-caption text-foreground">{host}</span>
          <CopyButton value={host} what={host} visible />
        </li>
      ))}
    </ul>
  )
}
