import { manifestSheetContent } from '@/data/manifest-sheet'
import { translation } from '@/lib/i18n'

export default [
  translation(manifestSheetContent, {
    printSelected: 'मैनिफ़ेस्ट प्रिंट करें',
    printAll: 'सभी मैनिफ़ेस्ट प्रिंट करें',
    printAllHint: 'हर पिकअप का एक पेज, कूरियर के पिकअप एग्ज़ीक्यूटिव के साइन की लाइन के साथ।',
    making: 'मैनिफ़ेस्ट बन रहा है…',
    failed: 'मैनिफ़ेस्ट नहीं बन पाया। फिर कोशिश करें।',
    tooMany: (max) =>
      `एक मैनिफ़ेस्ट पर ज़्यादा से ज़्यादा ${max} पार्सल प्रिंट करें। कम चुनकर फिर कोशिश करें।`,
    done: (parcels, pickups) => `मैनिफ़ेस्ट तैयार: ${pickups} पिकअप पर ${parcels} पार्सल।`,
  }),
]
