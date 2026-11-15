import { sharedParcelContent } from '@/data/shared-parcel'
import { translation } from '@/lib/i18n'

export default [
  translation(sharedParcelContent, {
    awbOnOther: (waybill, number, live) =>
      live
        ? `ट्रैकिंग नंबर ${waybill} पहले से ऑर्डर #${number} पर है। इस ऑर्डर को उसी बॉक्स में भेजने के लिए, आइटम भेजते समय "#${number} वाला बॉक्स" चुनें।`
        : `ट्रैकिंग नंबर ${waybill} ऑर्डर #${number} पर इस्तेमाल हो चुका है। इस ऑर्डर के लिए नया ट्रैकिंग नंबर डालें।`,
    label: 'पार्सल',
    ownParcel: 'अपना अलग पार्सल',
    sameBox: (number, courier, waybill) => `#${number} वाला बॉक्स (${courier}, AWB ${waybill})`,
    hint: 'इसी ग्राहक के किसी दूसरे ऑर्डर के बॉक्स में पैक किया? उसे चुनें: दूसरी बुकिंग नहीं होगी, और यह ऑर्डर उसी पार्सल की ट्रैकिंग के साथ चलेगा।',
    inSameBox: (number) => `ऑर्डर #${number} वाले बॉक्स में`,
    inSameBoxHint: 'कैंसल, पिकअप और ट्रैकिंग बदलना उसी ऑर्डर पर होता है।',
    alsoCarries: 'इसमें यह भी है',
    orderLink: (number) => `#${number}`,
  }),
]
