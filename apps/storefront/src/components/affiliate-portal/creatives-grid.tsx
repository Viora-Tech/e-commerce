'use client'

import { Copy, Download, FileText, Megaphone } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardFooter } from '@commerce/ui/shadcn/card'
import { Tabs, TabsList, TabsTrigger } from '@commerce/ui/shadcn/tabs'
import { useState } from 'react'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import PortalEmpty from './portal-empty'

type Creative = {
  id: string
  url: string
  contentType: string | null
  title: string
  caption: string
}

type CreativesGridProps = { creatives: Creative[] }

type Kind = 'all' | 'image' | 'video' | 'file'

const copy = affiliatePortalContent.marketing

/** An image, a video, or any other file, from its content type. */
function kindOf(c: Creative): Exclude<Kind, 'all'> {
  if (c.contentType?.startsWith('image/')) return 'image'
  if (c.contentType?.startsWith('video/')) return 'video'
  return 'file'
}

/** The store's files by type (All, Images, Videos, Files), each with Copy caption and Download. */
export default function CreativesGrid({ creatives }: CreativesGridProps) {
  // Hooks
  const [kind, setKind] = useState<Kind>('all')
  const [copied, setCopied] = useState<string | null>(null)

  // Event handlers
  const handleCopy = async (c: Creative) => {
    try {
      await navigator.clipboard.writeText(c.caption)
      setCopied(c.id)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied(null)
    }
  }

  // Early returns
  if (creatives.length === 0)
    return (
      <div className="px-4 lg:px-6">
        <PortalEmpty
          icon={Megaphone}
          title={copy.none.title}
          description={copy.none.text}
          className="border border-dashed"
        />
      </div>
    )

  // Render logic
  const shown = kind === 'all' ? creatives : creatives.filter((c) => kindOf(c) === kind)
  const tabs: { id: Kind; label: string }[] = [
    { id: 'all', label: copy.all },
    { id: 'image', label: copy.images },
    { id: 'video', label: copy.videos },
    { id: 'file', label: copy.files },
  ]
  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
        <TabsList className="gap-1">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((c) => {
          const k = kindOf(c)
          return (
            <Card key={c.id} className="overflow-hidden pt-0">
              <div className="flex aspect-square items-center justify-center bg-muted">
                {k === 'image' ? (
                  // biome-ignore lint/performance/noImgElement: the store's media from its CDN
                  <img
                    src={c.url}
                    alt={c.title}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                ) : k === 'video' ? (
                  // biome-ignore lint/a11y/useMediaCaption: the store's promo clip, no speech track
                  <video
                    src={c.url}
                    controls
                    preload="metadata"
                    className="size-full object-cover"
                  />
                ) : (
                  <FileText className="size-10 text-muted-foreground" />
                )}
              </div>
              <CardContent className="flex flex-col gap-1">
                {c.title ? <p className="text-sm font-medium">{c.title}</p> : null}
                {c.caption ? (
                  <p className="line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">
                    {c.caption}
                  </p>
                ) : null}
              </CardContent>
              <CardFooter className="mt-auto flex gap-2">
                {c.caption ? (
                  <Button size="sm" variant="outline" onClick={() => handleCopy(c)}>
                    <Copy />
                    {copied === c.id ? copy.copied : copy.copyCaption}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={<a href={c.url} download target="_blank" rel="noreferrer" />}
                >
                  <Download />
                  {copy.download}
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
