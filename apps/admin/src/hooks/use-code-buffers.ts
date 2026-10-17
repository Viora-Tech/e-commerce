'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { themeCodeContent } from '@/data/theme-code'
import { api } from '@/lib/api-client'
import { type CodeFile, type CodeFileList, codeFileName } from '@/lib/theme-code'

/** An open file: what is saved, what is in the editor, and the edits to undo. */
export type CodeBuffer = { file: CodeFile; saved: string; text: string; past: string[] }

/** Undo steps kept per file. */
const UNDO_KEPT = 100

const copy = themeCodeContent

/**
 * Edit code's files: the theme's file list, the open files' text (saved and edited), undo, and
 * save. A file is read once when first opened; Save sends it, and the saved text becomes the
 * new baseline for the gutter's changed-line marks.
 */
export function useCodeBuffers(themeId: string) {
  const [list, setList] = useState<CodeFileList | null>(null)
  const [listFailed, setListFailed] = useState(false)
  const [buffers, setBuffers] = useState<Record<string, CodeBuffer>>({})
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const loadList = async () => {
    setListFailed(false)
    try {
      setList(await api.themes.code.files({ themeId }))
    } catch {
      setListFailed(true)
    }
  }

  useEffect(() => {
    let current = true
    api.themes.code
      .files({ themeId })
      .then((l) => {
        if (current) setList(l)
      })
      .catch(() => {
        if (current) setListFailed(true)
      })
    return () => {
      current = false
    }
  }, [themeId])

  /** Reads a file the first time it opens (or again after a failed read). */
  const open = async (path: string, force = false) => {
    if (buffers[path] && !force) return
    setFailed((prev) => {
      const next = new Set(prev)
      next.delete(path)
      return next
    })
    try {
      const file = await api.themes.code.read({ themeId, path })
      setBuffers((prev) => ({
        ...prev,
        [path]: { file, saved: file.body, text: file.body, past: [] },
      }))
    } catch {
      setFailed((prev) => new Set(prev).add(path))
    }
  }

  const edit = (path: string, text: string) =>
    setBuffers((prev) => {
      const b = prev[path]
      if (!b || b.text === text) return prev
      return { ...prev, [path]: { ...b, text, past: [...b.past, b.text].slice(-UNDO_KEPT) } }
    })

  const undo = (path: string) =>
    setBuffers((prev) => {
      const b = prev[path]
      const last = b?.past.at(-1)
      if (!b || last === undefined) return prev
      return { ...prev, [path]: { ...b, text: last, past: b.past.slice(0, -1) } }
    })

  const close = (path: string) =>
    setBuffers((prev) => {
      const { [path]: _closed, ...rest } = prev
      return rest
    })

  /** Saves one file. Returns false when the server refused it (the reason is toasted). */
  const save = async (path: string): Promise<boolean> => {
    const b = buffers[path]
    if (!b) return false
    setSaving(true)
    try {
      await api.themes.code.save({ themeId, path, body: b.text })
      setBuffers((prev) => {
        const now = prev[path]
        return now ? { ...prev, [path]: { ...now, saved: b.text } } : prev
      })
      toast.success(copy.savedToast(codeFileName(path)))
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.saveFailed)
      return false
    } finally {
      setSaving(false)
    }
  }

  /** After "Restore whole theme": every open file is read again; unsaved edits give way. */
  const reloadOpen = async () => {
    await loadList()
    await Promise.all(Object.keys(buffers).map((p) => open(p, true)))
  }

  return {
    list,
    listFailed,
    buffers,
    failed,
    saving,
    loadList,
    open,
    edit,
    undo,
    close,
    save,
    reloadOpen,
  }
}
