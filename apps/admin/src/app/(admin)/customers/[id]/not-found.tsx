import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import PageBody from '@/components/layout/page-body'
import PageState from '@/components/states/page-state'
import { customersContent } from '@/data/customers'

export default function NotFound() {
  const { heading, body, action } = customersContent.detail

  return (
    <PageBody width="narrow">
      <PageState
        kind="not-found"
        heading={heading}
        body={body}
        action={
          <Button render={<Link href={action.href} />} nativeButton={false}>
            {action.label}
          </Button>
        }
      />
    </PageBody>
  )
}
