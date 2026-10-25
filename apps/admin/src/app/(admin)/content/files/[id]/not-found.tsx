import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import PageBody from '@/components/layout/page-body'
import PageState from '@/components/states/page-state'
import { mediaContent } from '@/data/media'

export default function NotFound() {
  const { heading, body, action } = mediaContent.details.notFound

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
