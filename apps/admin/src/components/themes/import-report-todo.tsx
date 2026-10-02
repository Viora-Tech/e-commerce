import type { ImportReport } from '@commerce/core/theme-import'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
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
    <Card className="gap-0 p-0">
      <CardHeader className="border-b border-border px-5 py-4">
        <CardTitle>{copy.todoHeading}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-5 py-4 text-body">
        {items.length === 0 ? <p className="text-muted-foreground">{copy.todoNone}</p> : null}
        {items.length ? (
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-foreground">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        {done ? <p className="text-muted-foreground">{done}</p> : null}
      </CardContent>
    </Card>
  )
}
