'use client'

import type { ProductStatus } from '@commerce/core/catalog'
import {
  AiIcon,
  Archive,
  CircleCheck,
  Download,
  FileEdit,
  Folder,
  Package,
  Pencil,
  Tag,
  Trash2,
} from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import RunAutomationDialog from '@/components/automations/records/run-automation-dialog'
import { useRunAutomation } from '@/components/automations/records/use-run-automation'
import ActionMenu, { type ActionItem } from '@/components/layout/action-menu'
import { assistantContent } from '@/data/assistant'
import { bulkActionsContent } from '@/data/bulk-actions'
import { productBulkShippingContent } from '@/data/product-bulk-shipping'
import { productsListContent } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { runBatched, toastOutcome } from '@/lib/run-batched'
import AddToCollectionDialog from './add-to-collection-dialog'
import BulkShippingDialog from './bulk-shipping-dialog'
import { downloadProductCsv } from './export-products'

type ExportRows = Awaited<ReturnType<typeof api.products.exportRows>>

type ProductBulkActionsProps = {
  /** The selected products. */
  ids: string[]
  busy: boolean
  onStatus: (status: ProductStatus) => void
  onTag: () => void
  /** "Remove tag" (#26), as on Orders. */
  onUntag: () => void
  onBulkEdit: () => void
  onDelete: () => void
  /** Bulk "Write with AI"; absent when AI is off or the role cannot write products. */
  onWriteAi?: (() => void) | undefined
  /** The Automations app is installed: "Run automation" on the selection. */
  automations?: boolean
  /** After products joined a collection or automation runs were queued: clear and reload. */
  onDone: () => void
}

/** Adds one product to a manual collection, keeping the other collections it sits in. */
async function withCollection(productId: string, collectionId: string) {
  const current = await api.collections.forProduct({ productId })
  if (current.includes(collectionId)) return
  await api.collections.setForProduct({ productId, collectionIds: [...current, collectionId] })
}

/**
 * The product list's bulk actions in the header bulk bar: Bulk edit, Set as active and Set as
 * draft as buttons; the rest (tag, collection, Write with AI, archive, export, automations,
 * delete) in More actions.
 */
export default function ProductBulkActions({
  ids,
  busy,
  onStatus,
  onTag,
  onUntag,
  onBulkEdit,
  onDelete,
  onWriteAi,
  automations = false,
  onDone,
}: ProductBulkActionsProps) {
  // Hooks
  const { bulk: copy, exporting } = useCopy(productsListContent)
  const { bulk: ai } = useCopy(assistantContent)
  const shared = useCopy(bulkActionsContent)
  const shippingCopy = useCopy(productBulkShippingContent)
  const automation = useRunAutomation('product', automations)
  const [working, setWorking] = useState(false)
  const [picking, setPicking] = useState(false)
  const [weighing, setWeighing] = useState(false)

  // Event handlers
  const handleAddToCollection = async (collectionId: string) => {
    setWorking(true)
    const outcome = await runBatched(ids, (id) => withCollection(id, collectionId))
    setWorking(false)
    setPicking(false)
    toastOutcome(outcome, shared.summary)
    onDone()
  }
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
  const disabled = busy || working
  const moreItems: ActionItem[] = [
    { label: copy.addTag, icon: Tag, onSelect: onTag },
    { label: copy.removeTag, icon: Tag, onSelect: onUntag },
    { label: copy.addToCollection, icon: Folder, onSelect: () => setPicking(true) },
    { label: shippingCopy.menu, icon: Package, onSelect: () => setWeighing(true) },
    { label: ai.button, icon: AiIcon, hidden: !onWriteAi, onSelect: onWriteAi },
    {
      label: copy.archive,
      icon: Archive,
      separatorBefore: true,
      onSelect: () => onStatus('archived'),
    },
    { label: copy.exportSelected, icon: Download, onSelect: () => void handleExport() },
    ...automation
      .items(ids)
      .map((item, i) => (i === 0 ? { ...item, separatorBefore: true } : item)),
    { label: copy.delete, icon: Trash2, destructive: true, onSelect: onDelete },
  ]

  return (
    <>
      <Button variant="outline" size="sm" disabled={disabled} onClick={onBulkEdit}>
        <Pencil aria-hidden="true" />
        {copy.bulkEdit}
      </Button>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onStatus('active')}>
        <CircleCheck aria-hidden="true" />
        {copy.setActive}
      </Button>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onStatus('draft')}>
        <FileEdit aria-hidden="true" />
        {copy.setDraft}
      </Button>
      <ActionMenu
        label={copy.more}
        trigger="button"
        align="start"
        items={moreItems}
        disabled={disabled}
        triggerClassName="h-8 rounded-sm px-3"
      />
      <AddToCollectionDialog
        count={picking ? ids.length : 0}
        busy={working}
        onClose={() => setPicking(false)}
        onApply={handleAddToCollection}
      />
      <BulkShippingDialog
        ids={weighing ? ids : []}
        onClose={() => setWeighing(false)}
        onDone={onDone}
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
