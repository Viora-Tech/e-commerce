'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { themeCodeContent } from '@/data/theme-code'
import { api } from '@/lib/api-client'
import {
  type CodeFile,
  type CodeFileList,
  codeFileName,
  editorText,
  unpublishedNames,
} from '@/lib/theme-code'

/** An open file: what is saved, what is in the editor, and the edits to undo. */
export type CodeBuffer = { file: CodeFile; saved: string; text: string; past: string[] }

/** Unsaved: the editor's text differs from the last saved text (undoing back to it is clean). */
export const isDirty = (b: CodeBuffer) => b.text !== b.saved

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
  const [publishing, setPublishing] = useState(false)
  /** Files the last Publish put live, until the page is left. */
  const [justPublished, setJustPublished] = useState<ReadonlySet<string>>(new Set())

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
      const body = editorText(file.body)
      setBuffers((prev) => ({
        ...prev,
        [path]: { file, saved: body, text: body, past: [] },
      }))
    } catch {
      setFailed((prev) => new Set(prev).add(path))
    }
  }

  const edit = (path: string, value: string) =>
    setBuffers((prev) => {
      const b = prev[path]
      const text = editorText(value)
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
      const { draft } = await api.themes.code.save({ themeId, path, body: b.text })
      setBuffers((prev) => {
        const now = prev[path]
        return now ? { ...prev, [path]: { ...now, saved: b.text } } : prev
      })
      toast.success(
        draft ? copy.draftSavedToast(codeFileName(path)) : copy.savedToast(codeFileName(path)),
      )
      // An imported theme's save is a draft: the list's "not published" count moves.
      if (list?.kind === 'imported') void loadList()
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.saveFailed)
      return false
    } finally {
      setSaving(false)
    }
  }

  /** Imported themes: puts every unpublished save live together. */
  const publish = async () => {
    setPublishing(true)
    try {
      const changed = list?.files.filter((f) => f.draft) ?? []
      const { published } = await api.themes.code.publish({ themeId })
      const { names, more } = unpublishedNames(changed)
      toast.success(copy.drafts.published(published), {
        description: more ? copy.drafts.moreFiles(names, more) : names,
      })
      setJustPublished(new Set(changed.map((f) => f.path)))
      await loadList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.drafts.publishFailed)
    } finally {
      setPublishing(false)
    }
  }

  /** Imported themes: drops every unpublished save; open files are read again. */
  const discard = async () => {
    try {
      await api.themes.code.discard({ themeId })
      toast.success(copy.drafts.discarded)
      await reloadOpen()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.drafts.discardFailed)
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
    publishing,
    justPublished,
    loadList,
    open,
    edit,
    undo,
    close,
    save,
    publish,
    discard,
    reloadOpen,
  }
}
