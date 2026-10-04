import { Braces, FileText, FolderOpen, Newspaper } from '@commerce/ui/icons'
import ProductThumb from '@/components/products/product-thumb'
import type { ReferenceKind } from './reference-search-dialog'

type ReferenceThumbProps = {
  kind: ReferenceKind
  url: string | null
}

const box =
  'flex size-8 shrink-0 items-center justify-center rounded-[0.25rem] border border-secondary bg-card text-muted-foreground [&_svg]:size-4'

const ICON = {
  metaobject: Braces,
  collection: FolderOpen,
  article: Newspaper,
  page: FileText,
  file: FileText,
} as const

/** Small square beside a reference: the image when there is one, else an icon for its kind. */
export default function ReferenceThumb({ kind, url }: ReferenceThumbProps) {
  // Early returns
  if (url || kind === 'product' || kind === 'variant') return <ProductThumb url={url} />

  // Render logic
  const Icon = ICON[kind]

  return (
    <span className={box} aria-hidden>
      <Icon />
    </span>
  )
}
