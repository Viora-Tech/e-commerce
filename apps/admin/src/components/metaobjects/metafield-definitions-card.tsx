'use client'

import type { MetafieldOwnerType } from '@commerce/core/metaobjects'
import { Pencil, Plus, Trash2 } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useState } from 'react'
import { toast } from 'sonner'
import { customDataContent, fieldTypeContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import ConfirmDelete from './confirm-delete'
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
  const types = useCopy(fieldTypeContent).types
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
    <Card>
      <CardHeader>
        <CardTitle>{copy.metafields.heading(owner)}</CardTitle>
        <CardDescription>{copy.metafields.body(owner)}</CardDescription>
        {canManage ? (
          <CardAction>
            <Button variant="outline" onClick={() => setEditing('new')}>
              <Plus />
              {copy.metafields.add}
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {definitions === null ? (
          <Skeleton className="h-16 w-full" />
        ) : rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-body text-muted-foreground">
            {copy.metafields.empty(owner)}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
            {rows.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-body-strong">{d.name}</span>
                    {d.storefrontAccess ? null : (
                      <Badge variant="neutral">{copy.metafields.hidden}</Badge>
                    )}
                  </span>
                  <span className="truncate text-caption text-muted-foreground">
                    <span className="font-mono">
                      {d.namespace}.{d.key}
                    </span>{' '}
                    · {d.list ? copy.metafields.listOf(types[d.type].label) : types[d.type].label} ·{' '}
                    {copy.metafields.values(d.values)}
                  </span>
                </div>
                {canManage ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={copy.metafields.edit}
                      onClick={() => setEditing(d)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={copy.metafields.delete}
                      onClick={() => setRemoving(d)}
                    >
                      <Trash2 />
                    </Button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <MetafieldDefinitionDialog
        open={editing !== null}
        ownerType={ownerType}
        definition={editing === 'new' ? null : editing}
        targets={targets}
        onClose={() => setEditing(null)}
        onSaved={onChanged}
      />
      <ConfirmDelete
        open={removing !== null}
        busy={busy}
        title={copy.remove.title(removing?.name ?? '')}
        body={copy.remove.body(removing?.values ?? 0)}
        confirm={copy.remove.confirm}
        cancel={copy.remove.cancel}
        onOpenChange={(open) => !open && setRemoving(null)}
        onConfirm={handleDelete}
      />
    </Card>
  )
}
