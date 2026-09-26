import { api } from '@/lib/api-client'

/**
 * "Place a test order": open the storefront checkout with the ₹1 test item in
 * a new tab. The tab opens before the request so pop-up blockers allow it.
 * Returns false when the link could not be made.
 */
export async function openTestOrder(): Promise<boolean> {
  const tab = window.open('', '_blank')
  try {
    const { url } = await api.payments.testOrderLink()
    if (tab) tab.location.href = url
    else window.location.href = url
    return true
  } catch {
    tab?.close()
    return false
  }
}
