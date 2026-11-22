'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { notificationsSettingsContent } from '@/data/notifications'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import type { NotificationsOverview } from './types'

type MessageId = Parameters<typeof api.notifications.sendTest>[0]['id']

/**
 * "Send me a test" for one message, from the notifications list or the message's own page: says
 * where it went (inbox, or the developer log), or why it could not go.
 */
export function useSendTest(overview: NotificationsOverview | null) {
  // Hooks
  const copy = useCopy(notificationsSettingsContent)
  const [testing, setTesting] = useState<string | null>(null)

  // Helpers
  const sendTest = async (id: string) => {
    if (!overview?.canSendTest) {
      toast.info(copy.test.noChannel)
      return
    }
    setTesting(id)
    try {
      const r = await api.notifications.sendTest({ id: id as MessageId })
      if (!r.ok) toast.error(r.error === 'no_channel' ? copy.test.noChannel : copy.test.failed)
      else if (overview.channels.email.state === 'connected' || overview.platformEmail) {
        toast.success(copy.test.sent(r.to))
      } else toast.success(copy.test.sentLog)
    } catch (err) {
      toast.error(errorText(err, copy.test.failed))
    } finally {
      setTesting(null)
    }
  }

  return { testing, sendTest }
}
