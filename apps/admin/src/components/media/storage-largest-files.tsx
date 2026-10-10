import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { mediaContent } from '@/data/media'
import { getCopy, getLocale } from '@/lib/copy-server'
import { formatters } from '@/lib/format'
import { routes } from '@/lib/routes'
import { fileName, formatBytes } from './file-meta'

export type LargestFile = {
  id: string
  key: string | null
  size: number | null
  createdAt: Date
  kind: 'image' | 'video' | 'document'
  usedBy: number
}

type StorageLargestFilesProps = {
  files: LargestFile[]
}

/** The "Largest files" table of the Storage frame: name and upload date, type, size, where it is used. */
export default async function StorageLargestFiles({ files }: StorageLargestFilesProps) {
  // Render logic
  const copy = (await getCopy(mediaContent)).usage.largest
  const fmt = formatters(await getLocale())

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {files.length === 0 ? (
          <p className="text-body text-muted-foreground">{copy.empty}</p>
        ) : (
          <table className="w-full text-body">
            <thead>
              <tr className="text-start text-caption text-muted-foreground">
                <th className="w-1/2 py-2 text-start font-medium">{copy.name}</th>
                <th className="py-2 text-start font-medium">{copy.type}</th>
                <th className="py-2 text-end font-medium">{copy.size}</th>
                <th className="py-2 text-end font-medium">{copy.usedOn}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {files.map((file) => (
                <tr key={file.id}>
                  <td className="max-w-0 py-2.5">
                    <span className="block truncate text-body-strong text-foreground">
                      {file.key ? fileName(file.key) : file.id}
                    </span>
                    <span className="block text-caption text-muted-foreground">
                      {copy.uploaded(fmt.date(file.createdAt))}
                    </span>
                  </td>
                  <td className="py-2.5 text-foreground">{copy.kind[file.kind]}</td>
                  <td className="py-2.5 text-end tabular-nums">
                    {file.size ? formatBytes(file.size) : ''}
                  </td>
                  <td className="py-2.5 text-end text-muted-foreground">
                    {file.usedBy > 0 ? copy.products(file.usedBy) : copy.unused}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex items-center justify-between text-caption text-muted-foreground">
          <span>{files.length > 0 ? copy.footer(files.length) : null}</span>
          <Link
            href={routes.content.files()}
            className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copy.viewAll}
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
