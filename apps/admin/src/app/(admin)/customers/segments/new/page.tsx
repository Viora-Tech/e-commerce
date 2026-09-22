import type { SegmentRules } from '@commerce/core/segments'
import type { Metadata } from 'next'
import SegmentForm from '@/components/customers/segment-form'
import type { SearchParams } from '@/lib/list-query'

export const metadata: Metadata = { title: 'New segment' }

type Props = { searchParams: Promise<SearchParams> }

const EMPTY: SegmentRules = { match: 'all', conditions: [] }

/** "Save as segment" on the customer list passes the current filter as `rules`. */
function parseRules(raw: string | string[] | undefined): SegmentRules {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return EMPTY
  try {
    const parsed = JSON.parse(value) as SegmentRules
    return parsed.conditions ? parsed : EMPTY
  } catch {
    return EMPTY
  }
}

export default async function Page({ searchParams }: Props) {
  const { rules } = await searchParams
  return <SegmentForm initialName="" initialRules={parseRules(rules)} />
}
