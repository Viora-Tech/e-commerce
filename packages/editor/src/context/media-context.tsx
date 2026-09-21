'use client'

import { createContext, type ReactNode, useContext } from 'react'

export type UploadedImage = { url: string; alt?: string | undefined; width?: number | undefined }

/** What the host app supplies so the editor can insert images. */
export type EditorMedia = {
  /** Upload a file and return its public URL. Return null to abort. */
  upload?: ((file: File) => Promise<UploadedImage | null>) | undefined
  /** Open the host's media library; call `onSelect` with the chosen image. */
  pick?: ((onSelect: (image: UploadedImage) => void) => void) | undefined
}

const MediaContext = createContext<EditorMedia | null>(null)

export default function MediaProvider({
  media,
  children,
}: {
  media: EditorMedia | null | undefined
  children: ReactNode
}) {
  return <MediaContext.Provider value={media ?? null}>{children}</MediaContext.Provider>
}

export function useEditorMedia(): EditorMedia | null {
  return useContext(MediaContext)
}
