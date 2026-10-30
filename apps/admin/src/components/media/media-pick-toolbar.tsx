'use client'

import { LayoutGrid, ListView, Search } from '@commerce/ui/icons'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { mediaContent } from '@/data/media'
import { useCopy } from '@/hooks/use-copy'
import type { MediaFolder } from './use-media-folders'

export type MediaSortKey = 'newest' | 'oldest' | 'name' | 'size'
export type MediaFileTypeFilter = 'all' | 'image' | 'video'
export type MediaSizeFilter = 'all' | 'small' | 'medium' | 'large'
export type MediaUsedFilter = 'all' | 'used' | 'unused'
export type MediaViewMode = 'grid' | 'list'

type MediaPickToolbarProps = {
  /** Hides sort and the filter chip row when the picker is scoped to a fixed list. */
  restricted: boolean
  query: string
  sort: MediaSortKey
  fileType: MediaFileTypeFilter
  size: MediaSizeFilter
  used: MediaUsedFilter
  /** Files folders (#91); the folder filter shows once the store has one. */
  folders: MediaFolder[]
  /** Folder id, or `all`. */
  folder: string
  onFolder: (value: string) => void
  view: MediaViewMode
  onQuery: (value: string) => void
  onSort: (value: MediaSortKey) => void
  onFileType: (value: MediaFileTypeFilter) => void
  onSize: (value: MediaSizeFilter) => void
  onUsed: (value: MediaUsedFilter) => void
  onView: (value: MediaViewMode) => void
}

/** Search, sort, grid/list toggle and the File type / File size / Used in filter chips. */
export default function MediaPickToolbar({
  restricted,
  query,
  sort,
  fileType,
  size,
  used,
  folders,
  folder,
  onFolder,
  view,
  onQuery,
  onSort,
  onFileType,
  onSize,
  onUsed,
  onView,
}: MediaPickToolbarProps) {
  // Hooks
  const { picker: copy, folders: folderCopy } = useCopy(mediaContent)
  const SORT_ITEMS = {
    newest: copy.sort.newest,
    oldest: copy.sort.oldest,
    name: copy.sort.name,
    size: copy.sort.size,
  }
  const FILE_TYPE_ITEMS = {
    all: copy.filters.fileType.all,
    image: copy.filters.fileType.image,
    video: copy.filters.fileType.video,
  }
  const SIZE_ITEMS = {
    all: copy.filters.size.all,
    small: copy.filters.size.small,
    medium: copy.filters.size.medium,
    large: copy.filters.size.large,
  }
  const FOLDER_ITEMS: Record<string, string> = Object.fromEntries([
    ['all', folderCopy.all],
    ...folders.map((f) => [f.id, f.name]),
  ])
  const USED_ITEMS = {
    all: copy.filters.used.all,
    used: copy.filters.used.used,
    unused: copy.filters.used.unused,
  }

  // Render logic
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={copy.search}
            className="pl-8"
            aria-label={copy.search}
          />
        </div>
        {!restricted ? (
          <Select
            items={SORT_ITEMS}
            value={sort}
            onValueChange={(v) => typeof v === 'string' && onSort(v as MediaSortKey)}
          >
            <SelectTrigger size="sm" aria-label={copy.sort.label}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SORT_ITEMS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <ToggleGroup
          value={[view]}
          onValueChange={(v) => typeof v[0] === 'string' && onView(v[0] as MediaViewMode)}
          variant="outline"
          spacing={0}
        >
          <ToggleGroupItem value="grid" aria-label={copy.view.grid} title={copy.view.grid}>
            <LayoutGrid aria-hidden />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label={copy.view.list} title={copy.view.list}>
            <ListView aria-hidden />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {!restricted ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            items={FILE_TYPE_ITEMS}
            value={fileType}
            onValueChange={(v) => typeof v === 'string' && onFileType(v as MediaFileTypeFilter)}
          >
            <SelectTrigger size="sm" aria-label={copy.filters.fileType.label}>
              <SelectValue placeholder={copy.filters.fileType.label} />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(FILE_TYPE_ITEMS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            items={SIZE_ITEMS}
            value={size}
            onValueChange={(v) => typeof v === 'string' && onSize(v as MediaSizeFilter)}
          >
            <SelectTrigger size="sm" aria-label={copy.filters.size.label}>
              <SelectValue placeholder={copy.filters.size.label} />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SIZE_ITEMS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {folders.length > 0 ? (
            <Select
              items={FOLDER_ITEMS}
              value={folder}
              onValueChange={(v) => typeof v === 'string' && onFolder(v)}
            >
              <SelectTrigger size="sm" aria-label={folderCopy.filter}>
                <SelectValue placeholder={folderCopy.filter} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FOLDER_ITEMS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Select
            items={USED_ITEMS}
            value={used}
            onValueChange={(v) => typeof v === 'string' && onUsed(v as MediaUsedFilter)}
          >
            <SelectTrigger size="sm" aria-label={copy.filters.used.label}>
              <SelectValue placeholder={copy.filters.used.label} />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(USED_ITEMS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </>
  )
}
