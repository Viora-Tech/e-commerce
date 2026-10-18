import { aboutContent as copy } from '@/data/about'
import PageContainer from '../common/page-container'

export default function AboutMadeIn() {
  return (
    <PageContainer as="section" className="py-8">
      <dl className="glass-panel grid gap-6 rounded-3xl p-7 sm:grid-cols-2 lg:grid-cols-4">
        {copy.madeIn.map((item) => (
          <div key={item.label} className="flex flex-col gap-1.5">
            <dt className="text-eyebrow">{item.label}</dt>
            <dd className="text-xl font-semibold text-foreground">{item.value}</dd>
          </div>
        ))}
      </dl>
    </PageContainer>
  )
}
