/**
 * Shopify Files (Content → Files): images, videos and other uploads, read page
 * by page, plus a single-file lookup for files that metafields and entries link
 * to. Videos come back as the best mp4 Shopify has under our video limit.
 */
import { VIDEO_MAX_UPLOAD_BYTES } from '@commerce/storage'
import type { ShopifyClient } from './shopify-client'
import type { NFile } from './types'

type Page<N> = { nodes: N[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }

type VideoSource = { url: string | null; mimeType: string | null; fileSize: number | null }

export type GFile = {
  __typename: string
  id: string
  alt: string | null
  fileStatus: string
  mimeType?: string | null
  image?: { url: string } | null
  originalSource?: (Partial<VideoSource> & { fileSize?: number | null }) | null
  url?: string | null
  originalFileSize?: number | null
  sources?: VideoSource[]
  originUrl?: string | null
}

const FILE_FIELDS = `__typename id alt fileStatus
  ... on MediaImage { mimeType image { url } originalSource { fileSize } }
  ... on GenericFile { url mimeType originalFileSize }
  ... on Video { originalSource { url mimeType fileSize } sources { url mimeType fileSize } }
  ... on ExternalVideo { originUrl }`

const FILES_QUERY = `query Files($cursor: String, $query: String) {
  files(first: 50, after: $cursor, sortKey: ID, query: $query) {
    pageInfo { hasNextPage endCursor }
    nodes { ${FILE_FIELDS} }
  }
}`

const FILE_NODE_QUERY = `query FileNode($id: ID!) { node(id: $id) { ... on File { ${FILE_FIELDS} } } }`

/** The mp4 to copy: the original when it fits, else the largest rendition that does. */
function bestMp4(f: GFile): { url: string | null; size: number | null; tooLarge: boolean } {
  const all = [f.originalSource as VideoSource | null | undefined, ...(f.sources ?? [])].filter(
    (s): s is VideoSource => Boolean(s?.url) && s?.mimeType === 'video/mp4',
  )
  const fits = all
    .filter((s) => (s.fileSize ?? 0) <= VIDEO_MAX_UPLOAD_BYTES)
    .sort((a, b) => (b.fileSize ?? 0) - (a.fileSize ?? 0))
  const pick = fits[0]
  if (pick) return { url: pick.url, size: pick.fileSize, tooLarge: false }
  return { url: null, size: all[0]?.fileSize ?? null, tooLarge: all.length > 0 }
}

export function mapFile(f: GFile): NFile {
  const base = { sourceId: f.id, alt: f.alt || null, status: f.fileStatus }
  switch (f.__typename) {
    case 'MediaImage':
      return {
        ...base,
        kind: 'image',
        url: f.image?.url ?? null,
        mimeType: f.mimeType ?? null,
        size: f.originalSource?.fileSize ?? null,
      }
    case 'Video': {
      const mp4 = bestMp4(f)
      return {
        ...base,
        kind: 'video',
        url: mp4.url,
        mimeType: mp4.url ? 'video/mp4' : (f.originalSource?.mimeType ?? null),
        size: mp4.size,
      }
    }
    case 'ExternalVideo':
      return {
        ...base,
        kind: 'external_video',
        url: f.originUrl ?? null,
        mimeType: null,
        size: null,
      }
    case 'Model3d':
      return { ...base, kind: 'model_3d', url: null, mimeType: null, size: null }
    default:
      return {
        ...base,
        kind: 'file',
        url: f.url ?? null,
        mimeType: f.mimeType ?? null,
        size: f.originalFileSize ?? null,
      }
  }
}

export async function* fetchFiles(
  client: ShopifyClient,
  search: string | null = null,
): AsyncGenerator<NFile[]> {
  for await (const nodes of client.paginate<GFile>(
    FILES_QUERY,
    (d) => (d as { files: Page<GFile> }).files,
    { query: search },
    150,
  )) {
    yield nodes.map(mapFile)
  }
}

/** One file by its Shopify id (a metafield or entry links to it). Null when it is not a file. */
export async function fetchFile(client: ShopifyClient, id: string): Promise<NFile | null> {
  const data = await client.query<{ node: GFile | null }>(FILE_NODE_QUERY, { id }, 10)
  return data.node?.id ? mapFile(data.node) : null
}
