'use client'

import type { MediaReference } from '@commerce/core'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Download,
  FileText,
  ImageIcon,
  Pencil,
} from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type ReactNode, useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import FallbackImage from '@/components/layout/fallback-image'
import PageHeader from '@/components/layout/page-header'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import { imageEditorContent } from '@/data/image-editor'
import { mediaContent } from '@/data/media'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { formatDateTime } from '@/lib/format-date'
import { isEditableImage } from '@/lib/image-edit'
import { routes } from '@/lib/routes'
import { makeVideoPoster } from '@/lib/upload'
import { contentTypeOf, displayName, fileKind, formatBytes } from './file-meta'
import ImageEditorDialog from './image-editor-dialog'
import MediaFileAlt from './media-file-alt'
import MediaFileLink from './media-file-link'
import MediaFileUsedIn from './media-file-used-in'

export type MediaFileData = Awaited<ReturnType<typeof api.media.get>>

type MediaFilePageProps = {
  file: MediaFileData
  usedIn: MediaReference[]
  /** The files either side in the library's order under its filter; null at either end. */
  neighbours: { previous: string | null; next: string | null }
  /** The library's search and type, carried to the previous / next links. */
  filter: { query: string | null; type: string | null }
}

/**
 * Content → Files → one file, after Payload's media edit view: a large preview and its
 * links on the left; what the file is, its alt text and the products using it on the right.
 */
export default function MediaFilePage({ file, usedIn, neighbours, filter }: MediaFilePageProps) {
  // Hooks
  const mediaCopy = useCopy(mediaContent)
  const { details: copy, library, toasts } = useCopy(mediaContent)
  const { title: editImageLabel } = useCopy(imageEditorContent)
  const router = useRouter()
  const [alt, setAlt] = useState(file.alt)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Event handlers
  const handleDelete = async () => {
    try {
      await api.media.delete({ id: file.id })
    } catch (err) {
      toast.error(errorText(err, mediaCopy.errors.generic))
      throw err
    }
    toast.success(toasts.deleted)
    router.push(routes.content.files())
  }
  const handleMakePoster = async () => {
    const id = toast.loading(copy.makePoster)
    const done = await makeVideoPoster({ id: file.id, url: file.url })
    if (done) toast.success(toasts.posterMade, { id })
    else toast.error(toasts.posterFailed, { id })
  }

  // Render logic
  const name = displayName(file) || copy.title
  const type = contentTypeOf(file.contentType, file.key ?? file.url)
  const kind = type?.startsWith('image/')
    ? 'image'
    : type?.startsWith('video/')
      ? 'video'
      : 'document'
  const typeLabel = fileKind(type) || type || ''
  const size = file.size ? formatBytes(file.size) : ''
  const dimensions = file.width && file.height ? `${file.width} × ${file.height} px` : ''
  const facts = [
    { label: copy.type, value: typeLabel },
    { label: copy.size, value: size },
    { label: copy.dimensions, value: dimensions },
    { label: copy.uploaded, value: formatDateTime(file.createdAt) },
    {
      label: copy.status,
      value: file.missing ? copy.missing : (copy.statuses[file.status] ?? file.status),
    },
  ].filter((f) => f.value)
  const previousHref = neighbours.previous ? routes.content.file(neighbours.previous, filter) : null
  const nextHref = neighbours.next ? routes.content.file(neighbours.next, filter) : null

  return (
    <ProoflyDetailPage
      header={
        <PageHeader
          title={name}
          subtitle={[typeLabel, size, dimensions].filter(Boolean).join(' · ')}
          back={{ label: copy.back, href: routes.content.files() }}
          lead={{ kind: 'icon', node: kind === 'image' ? <ImageIcon /> : <FileText /> }}
          actions={
            <>
              <StepLink href={previousHref} label={copy.previous}>
                <ChevronLeftIcon aria-hidden="true" />
              </StepLink>
              <StepLink href={nextHref} label={copy.next}>
                <ChevronRightIcon aria-hidden="true" />
              </StepLink>
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <a href={file.url} download={name} target="_blank" rel="noopener noreferrer" />
                }
              >
                <Download aria-hidden="true" />
                {copy.download}
              </Button>
              {isEditableImage(type) ? (
                <Button type="button" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden="true" />
                  {editImageLabel}
                </Button>
              ) : null}
              <ActionMenu
                label={copy.more}
                variant="outline"
                items={[
                  ...(kind === 'video'
                    ? [{ label: copy.makePoster, onSelect: () => void handleMakePoster() }]
                    : []),
                  { label: copy.delete, onSelect: () => setDeleting(true), destructive: true },
                ]}
              />
            </>
          }
        />
      }
      main={
        <>
          <DataCard title={copy.preview}>
            <div className="flex aspect-[4/3] max-h-[36rem] w-full items-center justify-center overflow-hidden rounded-lg border bg-muted">
              {kind === 'video' ? (
                // biome-ignore lint/a11y/useMediaCaption: merchant's own upload, previewed in admin.
                <video src={file.url} controls playsInline className="size-full object-contain" />
              ) : kind === 'image' ? (
                <FallbackImage
                  src={file.url}
                  alt={alt ?? ''}
                  className="size-full object-contain"
                  fallback={<FileText className="size-12 text-muted-foreground" aria-hidden />}
                />
              ) : (
                <FileText className="size-12 text-muted-foreground" aria-hidden />
              )}
            </div>
            {file.missing ? (
              <p className="mt-3 text-body text-destructive">{copy.missingHint}</p>
            ) : null}
          </DataCard>
          <DataCard title={copy.link}>
            <MediaFileLink url={file.url} variants={file.variants} />
          </DataCard>
        </>
      }
      side={
        <>
          <DataCard title={copy.details}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body">
              {facts.map((f) => (
                <div key={f.label} className="contents">
                  <dt className="text-muted-foreground">{f.label}</dt>
                  <dd className="text-right text-foreground tabular-nums">{f.value}</dd>
                </div>
              ))}
            </dl>
          </DataCard>
          <DataCard title={copy.alt}>
            <MediaFileAlt
              key={file.id}
              id={file.id}
              alt={alt}
              onSaved={(_, next) => setAlt(next)}
            />
          </DataCard>
          <DataCard title={copy.usedIn} count={usedIn.length}>
            <MediaFileUsedIn rows={usedIn} />
          </DataCard>
        </>
      }
    >
      <ImageEditorDialog
        item={editing ? { id: file.id, url: file.url, alt, contentType: type } : null}
        mode="copy"
        onClose={() => setEditing(false)}
        onSaved={(_, edited) => router.push(routes.content.file(edited.id, filter))}
      />
      <ConfirmDialog
        tone="destructive"
        open={deleting}
        onOpenChange={setDeleting}
        title={library.deleteTitle}
        body={library.deleteBody(usedIn.length)}
        confirmLabel={library.deleteConfirm}
        cancelLabel={library.cancel}
        onConfirm={handleDelete}
      />
    </ProoflyDetailPage>
  )
}

/** A previous / next arrow: a link while there is a file that way, dimmed at either end. */
function StepLink({
  href,
  label,
  children,
}: {
  href: string | null
  label: string
  children: ReactNode
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      disabled={!href}
      nativeButton={!href}
      render={href ? <Link href={href} /> : undefined}
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  )
}
