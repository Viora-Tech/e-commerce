'use client'

import type { OrderSheetRow } from '@commerce/api'
import { LayoutGrid } from '@commerce/ui/icons'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import SectionEmpty from '@/components/layout/section-empty'
import InlineState from '@/components/states/inline-state'
import { BULK_EDIT_IDS_KEY, ordersBulkEditContent } from '@/data/orders-bulk-edit'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import OrdersBulkEditor from './orders-bulk-editor'

type State =
  | { phase: 'loading' }
  | { phase: 'empty' }
  | { phase: 'failed' }
  | {
      phase: 'ready'
      sheet: OrderSheetRow[]
    }

const idsSchema = z.array(z.uuid()).max(5000)

/** The ids the Orders page left in sessionStorage; none when missing, malformed or empty. */
function readIds(): string[] {
  try {
    const parsed = idsSchema.safeParse(
      JSON.parse(sessionStorage.getItem(BULK_EDIT_IDS_KEY) ?? '[]'),
    )
    return parsed.success ? [...new Set(parsed.data)] : []
  } catch {
    return []
  }
}

/** Reads the selected order ids from sessionStorage, loads the sheet and hands it to the editor. */
export default function OrdersBulkLoader() {
  // Hooks
  const copy = useCopy(ordersBulkEditContent)
  const [state, setState] = useState<State>({ phase: 'loading' })

  useEffect(() => {
    let cancelled = false
    const ids = readIds()
    if (ids.length === 0) {
      setState({ phase: 'empty' })
      return
    }
    api.orders
      .sheet({ ids })
      .then((sheet) => !cancelled && setState({ phase: 'ready', sheet }))
      .catch(() => !cancelled && setState({ phase: 'failed' }))
    return () => {
      cancelled = true
    }
  }, [])

  // Early returns
  if (state.phase === 'loading')
    return <p className="px-4 py-6 text-caption text-muted-foreground md:px-8">{copy.loading}</p>
  if (state.phase === 'failed') return <InlineState kind="error" heading={copy.loadFailed} />
  if (state.phase === 'empty' || state.sheet.length === 0) {
    const { heading, body, action } = copy.empty
    return (
      <SectionEmpty
        heading={heading}
        body={body}
        action={{ label: action, href: routes.orders.list() }}
        icon={LayoutGrid}
      />
    )
  }

  // Render logic
  return <OrdersBulkEditor sheet={state.sheet} />
}
