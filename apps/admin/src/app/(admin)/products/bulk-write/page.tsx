import { BULK_WRITE_FIELDS, type BulkWriteField } from '@commerce/ai/client'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import BulkWritePage from '@/components/products/bulk-write/bulk-write-page'
import { assistantContent } from '@/data/assistant'
import { appRouter, call, serverContext } from '@/lib/api'
import type { SearchParams } from '@/lib/list-query'
import { type BulkWriteFrom, routes } from '@/lib/routes'

export const metadata: Metadata = { title: assistantContent.bulk.title }

/** Most products one run takes (the API's BULK_MAX). */
const RUN_MAX = 200
const FROM: readonly BulkWriteFrom[] = ['products', 'seo', 'readiness']

type Props = { searchParams: Promise<SearchParams> }

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

/** Products → Write with AI: `?ids=` starts a run for those products, `?job=` reopens a run. */
export default async function Page({ searchParams }: Props) {
  const params = await searchParams
  const ids = [
    ...new Set(
      first(params.ids)
        .split(',')
        .filter((id) => z.uuid().safeParse(id).success),
    ),
  ].slice(0, RUN_MAX)
  const job = first(params.job)
  const jobId = z.uuid().safeParse(job).success ? job : null
  const fields = first(params.fields)
    .split(',')
    .filter((f): f is BulkWriteField => (BULK_WRITE_FIELDS as readonly string[]).includes(f))
  const rawFrom = first(params.from)
  const from = FROM.find((f) => f === rawFrom) ?? 'products'

  const context = await serverContext()
  const ai = await call(appRouter.ai.status, undefined, { context }).catch(() => null)
  if (!ai?.bulkWriter || (!jobId && ids.length === 0)) redirect(routes.products.list())

  return (
    <BulkWritePage
      key={jobId ?? ids.join()}
      productIds={jobId ? null : ids}
      jobId={jobId}
      initialFields={fields.length ? fields : undefined}
      from={from}
    />
  )
}
