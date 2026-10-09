/** The Files tabs besides All; they filter by the file's type. */
export const FILE_TABS = ['image', 'video'] as const
export type FileTab = (typeof FILE_TABS)[number]

/** "1.2 MB", "840 KB": file sizes in the units the Files screens show. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1000))} KB`
}

/** The file's own name: the last part of its storage key. */
export function fileName(key: string): string {
  return key.split('/').pop() ?? key
}

/** "JPG", "PNG", "MP4": the short type label under a file. */
export function fileKind(contentType: string | null): string {
  const sub = contentType?.split('/')[1]?.split('+')[0]
  if (!sub) return ''
  return (sub === 'jpeg' ? 'jpg' : sub).toUpperCase()
}
