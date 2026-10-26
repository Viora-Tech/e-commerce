'use client'

import ErrorScreen from '@/components/errors/error-screen'

type StoreErrorProps = { error: unknown; retry: () => void }

/** A store page that failed: the error card inside the store's own header and footer. */
export default function StoreError({ error, retry }: StoreErrorProps) {
  return <ErrorScreen kind="store" error={error} retry={retry} />
}
