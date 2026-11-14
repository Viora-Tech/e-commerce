import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import SimpleTable from '@/components/table/simple-table'
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
    <DataCard title={copy.heading} bodyClassName="flex flex-col gap-3">
      {files.length === 0 ? (
        <EmptyState variant="inline" body={copy.empty} />
      ) : (
        <SimpleTable
          columns={[
            { key: 'name', label: copy.name, className: 'w-1/2' },
            { key: 'type', label: copy.type },
            { key: 'size', label: copy.size, align: 'end' },
            { key: 'used', label: copy.usedOn, align: 'end' },
          ]}
        >
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
        </SimpleTable>
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
    </DataCard>
  )
}
