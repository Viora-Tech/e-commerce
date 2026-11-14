import type { ImportReport } from '@commerce/core/theme-import'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import ScrollSection from '@/components/layout/scroll-section'
import type { themeImportContent } from '@/data/theme-import'

type ImportReportTodoProps = {
  copy: (typeof themeImportContent)['report']
  report: ImportReport
}

/** What the merchant still has to do: missing menus or products, pictures and videos to upload. */
export default function ImportReportTodo({ copy, report }: ImportReportTodoProps) {
  // Render logic
  const { missing, images } = report
  const items = [
    missing.menus.length ? copy.missing.menus(missing.menus.join(', ')) : null,
    missing.collections.length ? copy.missing.collections(missing.collections.join(', ')) : null,
    missing.products.length ? copy.missing.products(missing.products.join(', ')) : null,
    missing.blogs.length ? copy.missing.blogs(missing.blogs.join(', ')) : null,
    images.failed.length ? copy.images.failed(images.failed.length) : null,
    images.skippedNoHost ? copy.images.noHost(images.skippedNoHost) : null,
    report.videos.length ? copy.images.videos(report.videos.length) : null,
  ].filter((x): x is string => x !== null)
  const done = [
    images.copied ? copy.images.copied(images.copied) : null,
    images.videosCopied ? copy.images.videosCopied(images.videosCopied) : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <DataCard title={copy.todoHeading} bodyClassName="flex flex-col gap-2 text-body">
      {items.length === 0 ? <EmptyState variant="inline" body={copy.todoNone} /> : null}
      {items.length ? (
        <ScrollSection id="theme-report-todo" label={copy.todoHeading} maxHeight="min(20rem, 50vh)">
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-foreground">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </ScrollSection>
      ) : null}
      {done ? <p className="text-muted-foreground">{done}</p> : null}
    </DataCard>
  )
}
