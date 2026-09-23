import { Braces, FileText, FolderOpen } from '@commerce/ui/icons'
import ProductThumb from '@/components/products/product-thumb'

type ReferenceThumbProps = {
  kind: 'product' | 'collection' | 'metaobject' | 'file'
  url: string | null
}

const box =
  'flex size-8 shrink-0 items-center justify-center rounded-[0.25rem] border border-secondary bg-card text-muted-foreground [&_svg]:size-4'

/** Small square beside a reference: the image when there is one, else an icon for its kind. */
export default function ReferenceThumb({ kind, url }: ReferenceThumbProps) {
  // Early returns
  if (url || kind === 'product') return <ProductThumb url={url} />

  // Render logic
  return (
    <span className={box} aria-hidden>
      {kind === 'metaobject' ? <Braces /> : kind === 'collection' ? <FolderOpen /> : <FileText />}
    </span>
  )
}
