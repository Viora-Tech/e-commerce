import { Button } from '@commerce/ui/shadcn/button'
import { SearchX } from 'lucide-react'
import Link from 'next/link'
import { EmptyState } from '@/components/layout/empty-state'
import { PageBody } from '@/components/layout/page-body'
import { layoutContent } from '@/data/layout'

export default function NotFound() {
  const c = layoutContent.notFound
  return (
    <PageBody>
      <EmptyState
        icon={SearchX}
        heading={c.heading}
        body={c.body}
        action={
          <Button variant="outline" render={<Link href="/" />} nativeButton={false}>
            {c.home}
          </Button>
        }
      />
    </PageBody>
  )
}
