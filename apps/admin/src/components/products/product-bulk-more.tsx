'use client'

import type { ProductStatus } from '@commerce/core/catalog'
import { AiIcon, Archive, Download } from '@commerce/ui/icons'
import { useState } from 'react'
import { toast } from 'sonner'
import RunAutomationDialog from '@/components/automations/records/run-automation-dialog'
import { useRunAutomation } from '@/components/automations/records/use-run-automation'
import ActionMenu, { type ActionItem } from '@/components/layout/action-menu'
import { assistantContent } from '@/data/assistant'
import { productsListContent } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { downloadProductCsv } from './export-products'

type ExportRows = Awaited<ReturnType<typeof api.products.exportRows>>

type ProductBulkMoreProps = {
  /** The selected products. */
  ids: string[]
  busy: boolean
  onStatus: (status: ProductStatus) => void
  /** Bulk "Write with AI"; absent when AI is off or the role cannot write products. */
  onWriteAi?: (() => void) | undefined
  /** After automation runs were queued: clear the selection and reload. */
  onDone: () => void
  /** The Automations app is installed: "Run automation" on the selection. */
  automations?: boolean
}

/**
 * The selection header's ⋯ menu on the product list: the less common bulk actions (Write with
 * AI, Archive, Export, Run automation). The main ones sit in the floating bar
 * (`ProductBulkActions`), so the two never repeat each other (#808).
 */
export default function ProductBulkMore({
  ids,
  busy,
  onStatus,
  onWriteAi,
  onDone,
  automations = false,
}: ProductBulkMoreProps) {
  // Hooks
  const { bulk: copy, exporting } = useCopy(productsListContent)
  const { bulk: ai } = useCopy(assistantContent)
  const automation = useRunAutomation('product', automations)
  const [working, setWorking] = useState(false)

  // Event handlers
  /* exportRows takes at most 100 ids, so a bigger selection goes over in slices. */
  const handleExport = async () => {
    setWorking(true)
    try {
      const rows: ExportRows = []
      for (let i = 0; i < ids.length; i += 100) {
        rows.push(...(await api.products.exportRows({ ids: ids.slice(i, i + 100) })))
      }
      if (rows.length === 0) toast.error(exporting.empty)
      else downloadProductCsv(rows)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : exporting.failed)
    } finally {
      setWorking(false)
    }
  }

  // Render logic
  const items: ActionItem[] = [
    { label: ai.button, icon: AiIcon, hidden: !onWriteAi, onSelect: onWriteAi },
    { label: copy.archive, icon: Archive, onSelect: () => onStatus('archived') },
    { label: copy.exportSelected, icon: Download, onSelect: () => void handleExport() },
    ...automation
      .items(ids)
      .map((item, i) => (i === 0 ? { ...item, separatorBefore: true } : item)),
  ]

  return (
    <>
      <ActionMenu
        label={copy.more}
        trigger="kebab"
        size="md"
        align="end"
        items={items}
        disabled={busy || working}
        loading={working}
      />
      <RunAutomationDialog
        subjectType="product"
        ids={automation.target}
        onClose={automation.close}
        onDone={onDone}
      />
    </>
  )
}
