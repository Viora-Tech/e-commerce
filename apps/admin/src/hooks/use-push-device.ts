'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api-client'

/**
 * This browser's push state for Account → Notifications:
 * - `unsupported`: no service worker or Push API here (old browser, private window)
 * - `install`: an iPhone or iPad browser tab; push works only once the admin is on the Home Screen
 * - `blocked`: the member said no to notifications for this site, only browser settings undo it
 * - `off` / `on`: whether this browser is saved for the member in this store
 */
export type PushDeviceState = 'loading' | 'unsupported' | 'install' | 'blocked' | 'off' | 'on'

const SW_URL = '/push-sw.js'

/** The VAPID public key (base64url) as the bytes `PushManager.subscribe` wants. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replaceAll('-', '+').replaceAll('_', '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

const isAppleMobile = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

/** The browser's current subscription, if the push worker is registered. */
async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration(SW_URL)
  return reg ? reg.pushManager.getSubscription() : null
}

/**
 * Turns push on or off for this browser. `publicKey` null (no VAPID keys on the server) leaves
 * the state `unsupported`; `onDevices` reports the member's device count after a change.
 */
export function usePushDevice(publicKey: string | null, onDevices?: (devices: number) => void) {
  const [state, setState] = useState<PushDeviceState>('loading')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    const decide = async (): Promise<PushDeviceState> => {
      if (!publicKey) return 'unsupported'
      if (isAppleMobile() && !isStandalone()) return 'install'
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported'
      if (!('Notification' in window)) return 'unsupported'
      if (Notification.permission === 'denied') return 'blocked'
      return (await currentSubscription()) ? 'on' : 'off'
    }
    decide()
      .catch(() => 'unsupported' as const)
      .then((s) => {
        if (live) setState(s)
      })
    return () => {
      live = false
    }
  }, [publicKey])

  /** Asks for permission, subscribes and saves this browser. Throws with the browser's reason. */
  const turnOn = useCallback(async () => {
    if (!publicKey) return
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'off')
        return
      }
      // Its scope is the whole admin, the folder the script is served from.
      const reg = await navigator.serviceWorker.register(SW_URL)
      await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(publicKey),
        }))
      const json = sub.toJSON()
      const r = await api.account.savePushDevice({
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
        userAgent: navigator.userAgent.slice(0, 400),
      })
      setState('on')
      onDevices?.(r.devices)
    } finally {
      setBusy(false)
    }
  }, [publicKey, onDevices])

  /** Unsubscribes this browser and forgets it for the member. */
  const turnOff = useCallback(async () => {
    setBusy(true)
    try {
      const sub = await currentSubscription()
      if (sub) {
        const r = await api.account.removePushDevice({ endpoint: sub.endpoint })
        await sub.unsubscribe()
        onDevices?.(r.devices)
      }
      setState('off')
    } finally {
      setBusy(false)
    }
  }, [onDevices])

  return { state, busy, turnOn, turnOff }
}
