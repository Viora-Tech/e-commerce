import { buttonVariants } from '@commerce/ui/shadcn/button'
import { aboutContent as copy } from '@/data/about'
import PageContainer from '../common/page-container'
import ShopifyMock from '../home/shopify-mock'

export default function AboutFirstStore() {
  return (
    <PageContainer as="section" className="py-16 md:py-24">
      <div className="surface-card grid items-center gap-10 rounded-3xl p-7 md:p-12 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <p className="text-eyebrow">{copy.firstStore.eyebrow}</p>
          <h2 className="text-5xl font-semibold text-foreground md:text-6xl">
            {copy.firstStore.name}
          </h2>
          <p className="text-lead text-pretty text-muted-foreground">{copy.firstStore.body}</p>
          <a
            href={copy.firstStore.href}
            className={buttonVariants({ variant: 'outline', size: 'lg', className: 'w-fit' })}
          >
            {copy.firstStore.visit}
          </a>
        </div>
        <ShopifyMock variant="after" />
      </div>
    </PageContainer>
  )
}
