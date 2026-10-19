'use client'

import type { CustomerSheetRow } from '@commerce/api'
import type { ConsentChannel } from '@commerce/core/privacy'
import { LayoutGrid } from '@commerce/ui/icons'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import SectionEmpty from '@/components/layout/section-empty'
import InlineState from '@/components/states/inline-state'
import { CUSTOMERS_BULK_EDIT_IDS_KEY, customersBulkEditContent } from '@/data/customers-bulk-edit'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import CustomersBulkEditor from './customers-bulk-editor'

type State =
  | { phase: 'loading' }
  | { phase: 'empty' }
  | { phase: 'failed' }
  | {
      phase: 'ready'
      sheet: CustomerSheetRow[]
      sendable: readonly ConsentChannel[]
    }

const idsSchema = z.array(z.uuid()).max(5000)

/** The ids the Customers page left in sessionStorage; none when missing, malformed or empty. */
function readIds(): string[] {
  try {
    const parsed = idsSchema.safeParse(
      JSON.parse(sessionStorage.getItem(CUSTOMERS_BULK_EDIT_IDS_KEY) ?? '[]'),
    )
    return parsed.success ? [...new Set(parsed.data)] : []
  } catch {
    return []
  }
}

/** Reads the selected customer ids from sessionStorage, loads the sheet and hands it to the editor. */
export default function CustomersBulkLoader() {
  // Hooks
  const copy = useCopy(customersBulkEditContent)
  const [state, setState] = useState<State>({ phase: 'loading' })

  useEffect(() => {
    let cancelled = false
    const ids = readIds()
    if (ids.length === 0) {
      setState({ phase: 'empty' })
      return
    }
    Promise.all([api.customers.sheet({ ids }), api.customerPrivacy.sendableChannels()])
      .then(([sheet, sendable]) => !cancelled && setState({ phase: 'ready', sheet, sendable }))
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
        action={{ label: action, href: routes.customers.list() }}
        icon={LayoutGrid}
      />
    )
  }

  // Render logic
  return <CustomersBulkEditor sheet={state.sheet} sendable={state.sendable} />
}
