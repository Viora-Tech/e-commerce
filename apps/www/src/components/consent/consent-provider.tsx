'use client'

import { type ReactNode, useState, useSyncExternalStore } from 'react'
import {
  ACCEPT_ALL,
  CONSENT_UNKNOWN,
  type ConsentChoice,
  ESSENTIAL_ONLY,
  getConsentServerSnapshot,
  getConsentSnapshot,
  parseConsent,
  subscribeConsent,
  writeConsent,
} from '@/lib/consent'
import ConsentBanner from './consent-banner'
import { ConsentContext } from './consent-context'
import ConsentPreferencesModal from './consent-preferences-modal'

type ConsentProviderProps = { children: ReactNode }

export default function ConsentProvider({ children }: ConsentProviderProps) {
  // Hooks
  const raw = useSyncExternalStore(subscribeConsent, getConsentSnapshot, getConsentServerSnapshot)
  const [modalOpen, setModalOpen] = useState(false)

  // Event handlers
  const save = (choice: ConsentChoice) => {
    writeConsent(choice)
    setModalOpen(false)
  }

  // Render logic
  const stored = parseConsent(raw)
  const showBanner = raw !== CONSENT_UNKNOWN && stored === null && !modalOpen

  return (
    <ConsentContext.Provider value={{ openPreferences: () => setModalOpen(true) }}>
      {children}
      {showBanner ? (
        <ConsentBanner
          onPreferences={() => setModalOpen(true)}
          onReject={() => save(ESSENTIAL_ONLY)}
          onAccept={() => save(ACCEPT_ALL)}
        />
      ) : null}
      <ConsentPreferencesModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        current={stored ?? ESSENTIAL_ONLY}
        onSave={save}
      />
    </ConsentContext.Provider>
  )
}
