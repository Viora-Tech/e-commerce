'use client'

import dynamic from 'next/dynamic'

/*
 * The Orders list's dialogs, closed at load: each one's code loads when it first opens
 * (render it only once used, `useOpenedOnce`), not with the list.
 */

export const OrdersBulkDialogs = dynamic(() => import('./orders-bulk-dialogs'), { ssr: false })

export const BulkFulfilDialog = dynamic(() => import('./bulk-fulfil-dialog'), { ssr: false })

export const DeleteTestOrdersDialog = dynamic(() => import('./delete-test-orders-dialog'), {
  ssr: false,
})
