'use client'

import type { Permission } from '@commerce/core/permissions'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@commerce/ui/shadcn/sheet'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PermissionSwitches from '@/components/staff/permission-switches'
import { staffContent as copy } from '@/data/staff'
import { refreshPermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'

export type EditableRole = {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  permissions: Permission[]
}

type RoleSheetProps = {
  open: boolean
  role: EditableRole | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

/** Create or edit a role. Built in roles open read only. */
export default function RoleSheet({ open, role, onOpenChange, onSaved }: RoleSheetProps) {
  // Hooks
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [granted, setGranted] = useState<Permission[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(role?.name ?? '')
    setDescription(role?.description ?? '')
    setGranted(role?.permissions ?? [])
  }, [open, role])

  // Event handlers
  const handleSave = async () => {
    setSaving(true)
    try {
      await api.staff.saveRole({
        id: role?.id,
        name: name.trim(),
        description: description.trim() || null,
        permissions: granted,
      })
      refreshPermissions()
      toast.success(copy.roles.saved)
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.errors.load)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const readOnly = role?.isSystem === true

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{role ? copy.roleForm.editTitle : copy.roleForm.createTitle}</SheetTitle>
          <SheetDescription>
            {readOnly ? copy.roleForm.readOnly : copy.members.intro}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="role-name">{copy.roleForm.name}</Label>
            <Input
              id="role-name"
              value={name}
              disabled={readOnly}
              placeholder={copy.roleForm.namePlaceholder}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="role-description">{copy.roleForm.description}</Label>
            <Input
              id="role-description"
              value={description}
              disabled={readOnly}
              placeholder={copy.roleForm.descriptionPlaceholder}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-body-strong text-ink-strong">{copy.roleForm.permissions}</p>
            <PermissionSwitches value={granted} disabled={readOnly} onChange={setGranted} />
          </div>
        </div>
        <SheetFooter className="flex-row justify-end gap-2">
          <SheetClose render={<Button variant="outline" />}>{copy.roleForm.cancel}</SheetClose>
          <Button disabled={readOnly || saving || !name.trim()} onClick={handleSave}>
            {copy.roleForm.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
