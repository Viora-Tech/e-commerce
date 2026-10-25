'use client'

import type { SegmentRules } from '@commerce/core/segments'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import { customersContent, segmentsContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import { routes } from '@/lib/routes'
import CustomerAvatar from './customer-avatar'

type SegmentPreviewProps = { rules: SegmentRules }

type Preview = Awaited<ReturnType<typeof api.customers.previewSegment>>

const DEBOUNCE_MS = 400

/** Live count and a handful of matching customers while the rules change. */
export default function SegmentPreview({ rules }: SegmentPreviewProps) {
  // Hooks
  const segments = useCopy(segmentsContent)
  const customersCopy = useCopy(customersContent)
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
  const copy = segments.builder
  const unnamed = customersCopy.unnamed
  const total = preview?.total ?? 0

  return (
    <DataCard title={copy.preview} className="rounded-xl">
      <p
        className={`text-stat text-ink-strong tabular-nums transition-opacity ${loading ? 'opacity-60' : ''}`}
        aria-busy={loading}
      >
        {copy.previewCount(total)}
      </p>
      <p className="text-caption text-muted-foreground">
        {rules.conditions.length === 0 ? copy.previewAll : copy.previewLive}
      </p>
      {total === 0 && !loading ? (
        <p className="mt-3 text-body text-muted-foreground">{copy.previewEmpty}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-1">
          {(preview?.sample ?? []).map((c) => (
            <li key={c.id}>
              <Link
                href={routes.customers.detail(c.id)}
                className="flex items-center gap-3 rounded-md p-1.5 transition-colors hover:bg-muted"
              >
                <CustomerAvatar name={c.name} email={c.email} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium">{c.name ?? unnamed}</span>
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
