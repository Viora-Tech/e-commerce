'use client'

import { Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { AppPageProps } from '@/apps/registry'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import OptionForm from './option-form'
import { type OptionForm as Form, formOf, inputOf } from './option-form-state'

const APP = 'delivery-options'

/** One delivery option, as a full page with a save bar (`/apps/delivery-options/options/<id>`, `new`). */
export default function DeliveryOptionPage({ params }: AppPageProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const router = useRouter()
  // The new page becomes the saved option's page after its first save.
  const [id, setId] = useState(() => (params.id === 'new' ? null : (params.id ?? null)))
  const [form, setForm] = useState<Form | null>(id ? null : formOf(null))
  const [saved, setSaved] = useState<string>(JSON.stringify(formOf(null)))
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!id) return
    api.deliveryOptions
      .option({ id })
      .then((o) => {
        const f = formOf(o)
        setForm(f)
        setSaved(JSON.stringify(f))
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : copy.failed))
  }, [id, copy.failed])

  // Event handlers
  const handleSave = async () => {
    if (!form) return
    if (!form.name.trim()) {
      toast.error(copy.ruleDialog.errors.name)
      return
    }
    setBusy(true)
    try {
      const next = await api.deliveryOptions.saveOption({ id, option: inputOf(form) })
      const f = formOf(next)
      setForm(f)
      setSaved(JSON.stringify(f))
      toast.success(copy.saved)
      if (!id) {
        setId(next.id)
        router.replace(routes.apps.page(APP, 'options', next.id))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }
  const handleDiscard = () => setForm(JSON.parse(saved) as Form)
  const handleDelete = async () => {
    if (!id) return
    try {
      await api.deliveryOptions.deleteOption({ id })
      toast.success(copy.deleted)
      router.push(routes.apps.page(APP))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    }
  }

  // Early returns
  if (!form) return null

  // Render logic
  const dirty = !id || JSON.stringify(form) !== saved

  return (
    <div className="flex flex-col gap-5">
      <SaveBar
        open={dirty}
        message={copy.option.unsaved}
        saveLabel={copy.save}
        discardLabel={copy.option.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader
        title={id ? form.name || copy.option.newTitle : copy.option.newTitle}
        back={{ label: copy.option.back, href: routes.apps.page(APP) }}
      />
      <OptionForm form={form} onChange={setForm} />
      {id ? (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setConfirming(true)}>
            <Trash2 aria-hidden />
            {copy.delete}
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={copy.delete}
        body={copy.option.deleteConfirm}
        confirmLabel={copy.delete}
        tone="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
