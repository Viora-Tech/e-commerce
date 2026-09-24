'use client'

import { Plus, Save, Search } from '@commerce/ui/icons'
import { Input } from '@commerce/ui/shadcn/input'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import KitButton from '@/components/kit/kit-button'
import { productFormContent } from '@/data/products'

type ProductPageActionsProps = {
  busy: boolean
  onPublish: () => void
  onSaveDraft: () => void
}

const copy = productFormContent

/** Frame 5:5252 and 5:5104: product search, then publish, save to draft and a fresh form. */
export default function ProductPageActions({
  busy,
  onPublish,
  onSaveDraft,
}: ProductPageActionsProps) {
  // Hooks
  const router = useRouter()
  const [search, setSearch] = useState('')

  // Event handlers
  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    const query = search.trim()
    router.push(query ? `/products?query=${encodeURIComponent(query)}` : '/products')
  }

  // Render logic
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form onSubmit={handleSearch} className="relative w-full min-w-0 sm:w-60">
        <Search
          className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          size="kit"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={copy.searchPlaceholder}
          aria-label={copy.searchPlaceholder}
          className="pl-8"
        />
      </form>
      <KitButton
        variant="secondary"
        href="/products/new"
        aria-label={copy.addAnother}
        className="size-9 min-w-0 px-0"
      >
        <Plus className="size-4" aria-hidden="true" />
      </KitButton>
      <KitButton variant="secondary" onClick={onSaveDraft} disabled={busy}>
        <Save className="size-4" aria-hidden="true" />
        {copy.saveDraft}
      </KitButton>
      <KitButton variant="primary" onClick={onPublish} disabled={busy}>
        {copy.publish}
      </KitButton>
    </div>
  )
}
