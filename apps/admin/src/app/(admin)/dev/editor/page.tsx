import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import EditorPlayground from './editor-playground'

export const metadata: Metadata = { title: 'Editor playground' }

/** Development-only preview of the shared rich-text editor. */
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <EditorPlayground />
}
