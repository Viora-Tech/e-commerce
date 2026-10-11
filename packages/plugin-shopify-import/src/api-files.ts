/**
 * Shopify Files (Content → Files): images, videos and other uploads, read page
 * by page, plus a single-file lookup for files that metafields and entries link
 * to. Videos come back as the best mp4 Shopify has under the import's video limit (1 GB, streamed).
 */
import { IMPORT_VIDEO_MAX_BYTES } from './limits'
import type { ShopifyClient } from './shopify-client'
import type { NFile } from './types'

type Page<N> = { nodes: N[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }

type VideoSource = {
  url: string | null
  mimeType: string | null
  fileSize: number | null
  height?: number | null
  width?: number | null
}

export type GFile = {
  __typename: string
  id: string
  alt: string | null
  fileStatus: string
  mimeType?: string | null
  image?: { url: string; width?: number | null; height?: number | null } | null
  originalSource?: (Partial<VideoSource> & { fileSize?: number | null }) | null
  url?: string | null
  originalFileSize?: number | null
  sources?: VideoSource[]
  originUrl?: string | null
  preview?: { image?: { url: string } | null } | null
  filename?: string | null
}

const FILE_FIELDS = `__typename id alt fileStatus
  ... on MediaImage { mimeType image { url width height } originalSource { fileSize } }
  ... on GenericFile { url mimeType originalFileSize }
  ... on Video { filename preview { image { url } } originalSource { url mimeType fileSize } sources { url mimeType fileSize height width } }
  ... on ExternalVideo { originUrl }`

const FILES_QUERY = `query Files($cursor: String, $query: String) {
  files(first: 50, after: $cursor, sortKey: ID, query: $query) {
    pageInfo { hasNextPage endCursor }
    nodes { ${FILE_FIELDS} }
  }
}`

const FILE_NODE_QUERY = `query FileNode($id: ID!) { node(id: $id) { ... on File { ${FILE_FIELDS} } } }`

/** Tallest picture we copy for the main file: a 4K original is never needed on a storefront. */
const MAIN_MAX_HEIGHT = 1080
/** A phone gets a rendition at most this tall, when Shopify has a smaller one than the main file. */
const MOBILE_MAX_HEIGHT = 720

type Mp4Pick = { url: string; size: number | null; height: number | null }

/**
 * The mp4s to copy. Main: the tallest rendition up to 1080p (the original when Shopify lists
 * no renditions); without heights, the largest that fits the limit. Mobile: the tallest
 * rendition up to 720p that is smaller than the main one, when there is one.
 */
function bestMp4(f: GFile): {
  url: string | null
  size: number | null
  tooLarge: boolean
  mobileUrl: string | null
  mobileSize: number | null
} {
  const all = [...(f.sources ?? []), f.originalSource as VideoSource | null | undefined].filter(
    (s): s is VideoSource & { url: string } => Boolean(s?.url) && s?.mimeType === 'video/mp4',
  )
  const fits: Mp4Pick[] = all
    .filter((s) => (s.fileSize ?? 0) <= IMPORT_VIDEO_MAX_BYTES)
    .map((s) => ({ url: s.url, size: s.fileSize, height: s.height ?? null }))
  const tallest = (list: Mp4Pick[]) =>
    [...list].sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.size ?? 0) - (a.size ?? 0))[0]
  const known = fits.filter((s) => s.height !== null)
  const underMain = known.filter((s) => (s.height ?? 0) <= MAIN_MAX_HEIGHT)
  const largest = [...fits].sort((a, b) => (b.size ?? 0) - (a.size ?? 0))[0]
  const pick = tallest(underMain) ?? (known.length === 0 ? largest : tallest(known))
  if (!pick)
    return {
      url: null,
      size: all[0]?.fileSize ?? null,
      tooLarge: all.length > 0,
      mobileUrl: null,
      mobileSize: null,
    }
  const mobile = tallest(
    known.filter(
      (s) => (s.height ?? 0) <= MOBILE_MAX_HEIGHT && (s.height ?? 0) < (pick.height ?? 0),
    ),
  )
  return {
    url: pick.url,
    size: pick.size,
    tooLarge: false,
    mobileUrl: mobile?.url ?? null,
    mobileSize: mobile?.size ?? null,
  }
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
        width: f.image?.width ?? null,
        height: f.image?.height ?? null,
      }
    case 'Video': {
      const mp4 = bestMp4(f)
      return {
        ...base,
        kind: 'video',
        filename: f.filename ?? null,
        url: mp4.url,
        mobileUrl: mp4.mobileUrl,
        mobileSize: mp4.mobileSize,
        posterUrl: f.preview?.image?.url ?? null,
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
