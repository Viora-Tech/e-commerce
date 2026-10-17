'use client'

import type { MetafieldOwnerType } from '@commerce/core/metaobjects'
import { Pencil, Plus, Trash2 } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import { customDataContent, fieldTypeContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import MetafieldDefinitionDialog, {
  type MetafieldDefinitionRow,
} from './metafield-definition-dialog'

type MetafieldDefinitionsCardProps = {
  ownerType: MetafieldOwnerType
  definitions: MetafieldDefinitionRow[] | null
  targets: { id: string; name: string }[]
  canManage: boolean
  onChanged: () => void
}

/** One owner type's metafield definitions, with add, edit and delete. */
export default function MetafieldDefinitionsCard({
  ownerType,
  definitions,
  targets,
  canManage,
  onChanged,
}: MetafieldDefinitionsCardProps) {
  // Hooks
  const copy = useCopy(customDataContent)
  const { types } = useCopy(fieldTypeContent)
  const [editing, setEditing] = useState<MetafieldDefinitionRow | 'new' | null>(null)
  const [removing, setRemoving] = useState<MetafieldDefinitionRow | null>(null)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleDelete = async () => {
    if (!removing) return
    setBusy(true)
    try {
      await api.metaobjects.deleteMetafieldDefinition({ id: removing.id })
      toast.success(copy.remove.done)
      setRemoving(null)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.dialog.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const owner = copy.owners[ownerType]
  const rows = definitions ?? []

  return (
    <DataCard
      title={copy.metafields.heading(owner)}
      subtitle={copy.metafields.body(owner)}
      action={
        canManage ? (
          <Button variant="outline" onClick={() => setEditing('new')}>
            <Plus />
            {copy.metafields.add}
          </Button>
        ) : null
      }
    >
      {definitions === null ? (
        <Skeleton className="h-16 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState variant="dashed" size="md" body={copy.metafields.empty(owner)} />
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {rows.map((d) => (
            <li key={d.id} className="flex items-center gap-4 px-3 py-2.5">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-body-strong">{d.name}</span>
                  {d.storefrontAccess ? null : (
                    <Badge variant="neutral">{copy.metafields.hidden}</Badge>
                  )}
                </span>
                <span className="truncate font-mono text-caption text-muted-foreground">
                  {d.namespace}.{d.key}
                </span>
              </div>
              <span className="hidden w-32 shrink-0 truncate text-body text-foreground sm:block">
                {d.list ? copy.metafields.listOf(types[d.type].label) : types[d.type].label}
              </span>
              <span className="hidden w-24 shrink-0 text-body text-foreground tabular-nums sm:block">
                {copy.metafields.values(d.values)}
              </span>
              {canManage ? (
                <ActionMenu
                  label={copy.metafields.actions(d.name)}
                  trigger="kebab-vertical"
                  size="md"
                  items={[
                    { label: copy.metafields.edit, icon: Pencil, onSelect: () => setEditing(d) },
                    {
                      label: copy.metafields.delete,
                      icon: Trash2,
                      destructive: true,
                      onSelect: () => setRemoving(d),
                    },
                  ]}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <MetafieldDefinitionDialog
        open={editing !== null}
        ownerType={ownerType}
        definition={editing === 'new' ? null : editing}
        targets={targets}
        onClose={() => setEditing(null)}
        onSaved={onChanged}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={copy.remove.title(removing?.name ?? '')}
        body={copy.remove.body(removing?.values ?? 0)}
        confirmLabel={copy.remove.confirm}
        cancelLabel={copy.remove.cancel}
        busy={busy}
        onConfirm={() => void handleDelete()}
      />
    </DataCard>
  )
}
