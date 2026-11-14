'use client'

import EditorLoading from '@/components/themes/customize/editor-loading'

/** The editor's own skeleton while its server reads run, instead of a blank screen. */
export default function Loading() {
  return <EditorLoading storeName="" state="loading" onRetry={() => undefined} />
}
