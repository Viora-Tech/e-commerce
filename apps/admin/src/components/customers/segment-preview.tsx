'use client'

import type { SegmentRules } from '@commerce/core/segments'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import { segmentsContent as copy, customersContent } from '@/data/customers'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import CustomerAvatar from './customer-avatar'

type SegmentPreviewProps = { rules: SegmentRules }

type Preview = Awaited<ReturnType<typeof api.customers.previewSegment>>

const DEBOUNCE_MS = 400

/** Live count and a handful of matching customers while the rules change. */
export default function SegmentPreview({ rules }: SegmentPreviewProps) {
  // Hooks
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      api.customers
        .previewSegment({ rules })
        .then((p) => !cancelled && setPreview(p))
        .finally(() => !cancelled && setLoading(false))
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [rules])

  // Render logic
  const total = preview?.total ?? 0

  return (
    <DataCard title={copy.builder.preview}>
      <p className="text-stat text-ink-strong tabular-nums" aria-busy={loading}>
        {copy.builder.previewCount(total)}
      </p>
      {total === 0 && !loading ? (
        <p className="mt-3 text-body text-muted-foreground">{copy.builder.previewEmpty}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {(preview?.sample ?? []).map((c) => (
            <li key={c.id}>
              <Link
                href={`/customers/${c.id}`}
                className="flex items-center gap-3 rounded-md p-1 hover:bg-muted"
              >
                <CustomerAvatar name={c.name} email={c.email} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-strong">
                    {c.name ?? customersContent.unnamed}
                  </span>
                  <span className="block truncate text-caption text-muted-foreground">
                    {c.email ?? ''}
                  </span>
                </span>
                <span className="text-body tabular-nums">{formatPaise(c.spentPaise)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  )
}
