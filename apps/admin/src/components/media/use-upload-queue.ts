import { useState } from 'react'
import { toast } from 'sonner'
import { mediaContent } from '@/data/media'
import { rejectReason, type UploadedMedia, uploadFile } from '@/lib/upload'

export type PendingUpload = {
  key: string
  name: string
  previewUrl: string
  progress: number
  error: string | null
  file: File
}

/**
 * Tracks in-flight uploads for a dropzone: one entry per file with progress
 * and a retry hook. Finished files are handed to `onDone` and leave the
 * queue; failed ones stay until retried or dismissed.
 */
export function useUploadQueue(onDone: (item: UploadedMedia) => void) {
  const [pending, setPending] = useState<PendingUpload[]>([])

  const update = (key: string, patch: Partial<PendingUpload>) =>
    setPending((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)))

  const run = async (entry: PendingUpload) => {
    try {
      const done = await uploadFile(entry.file, (f) => update(entry.key, { progress: f }))
      setPending((list) => list.filter((p) => p.key !== entry.key))
      URL.revokeObjectURL(entry.previewUrl)
      onDone(done)
      return true
    } catch (err) {
      update(entry.key, { error: err instanceof Error ? err.message : mediaContent.errors.generic })
      return false
    }
  }

  const start = async (files: File[]) => {
    const accepted: PendingUpload[] = []
    for (const file of files) {
      const reason = rejectReason(file)
      if (reason) {
        toast.error(reason)
        continue
      }
      accepted.push({
        key: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        error: null,
        file,
      })
    }
    if (!accepted.length) return
    setPending((list) => [...list, ...accepted])
    const results = await Promise.all(accepted.map(run))
    const ok = results.filter(Boolean).length
    if (ok) toast.success(mediaContent.toasts.uploaded(ok))
  }

  const retry = (key: string) => {
    const entry = pending.find((p) => p.key === key)
    if (!entry) return
    update(key, { error: null, progress: 0 })
    void run(entry)
  }

  const dismiss = (key: string) => {
    const entry = pending.find((p) => p.key === key)
    if (entry) URL.revokeObjectURL(entry.previewUrl)
    setPending((list) => list.filter((p) => p.key !== key))
  }

  return { pending, start, retry, dismiss }
}
