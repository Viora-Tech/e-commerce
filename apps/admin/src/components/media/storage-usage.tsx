import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { mediaContent } from '@/data/media'
import { getCopy } from '@/lib/copy-server'
import { formatBytes } from './file-meta'
import StorageLargestFiles, { type LargestFile } from './storage-largest-files'

export type StorageUsageData = {
  totalBytes: number
  image: { bytes: number }
  video: { bytes: number }
  document: { bytes: number }
  largest: LargestFile[]
}

type StorageUsageProps = {
  usage: StorageUsageData
}

const KINDS = [
  { kind: 'image', bar: 'bg-primary' },
  { kind: 'video', bar: 'bg-info' },
  { kind: 'document', bar: 'bg-warning' },
] as const

/** Content › Files › Storage, top: bytes by type as one bar with a legend, then the biggest files. */
export default async function StorageUsage({ usage }: StorageUsageProps) {
  // Render logic
  const copy = (await getCopy(mediaContent)).usage

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{copy.heading}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div
            role="img"
            aria-label={`${copy.bar}: ${copy.used(formatBytes(usage.totalBytes))}`}
            className="flex h-2.5 overflow-hidden rounded-full bg-muted"
          >
            {KINDS.map(({ kind, bar }) => (
              <div
                key={kind}
                className={bar}
                style={{
                  width: `${usage.totalBytes > 0 ? (usage[kind].bytes / usage.totalBytes) * 100 : 0}%`,
                }}
              />
            ))}
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-2">
            {KINDS.map(({ kind, bar }) => (
              <div key={kind} className="flex flex-col">
                <dt className="flex items-center gap-1.5 text-caption text-muted-foreground">
                  <span aria-hidden className={`size-2 rounded-full ${bar}`} />
                  {copy.kinds[kind]}
                </dt>
                <dd className="text-body-strong text-foreground tabular-nums">
                  {formatBytes(usage[kind].bytes)}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <StorageLargestFiles files={usage.largest} />
    </>
  )
}
