'use client'

import { useState } from 'react'
import ChannelConnectPage from './channel-connect-page'
import SesSetupCard from './ses-setup-card'

/** Apps → Amazon SES email → Connect, with the after-save check and the bounce setup. */
export default function SesConnectPage() {
  // Hooks
  const [saves, setSaves] = useState(0)

  // Event handlers
  const handleSaved = () => setSaves((n) => n + 1)

  return (
    <ChannelConnectPage
      channelId="ses"
      hint={<SesSetupCard runKey={saves} />}
      onSaved={handleSaved}
    />
  )
}
