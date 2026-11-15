import { sharedParcelContent } from '@/data/shared-parcel'
import { translation } from '@/lib/i18n'

export default [
  translation(sharedParcelContent, {
    awbOnOther: (waybill, number, live) =>
      live
        ? `ट्रैकिंग नंबर ${waybill} पहले से ऑर्डर #${number} पर है। इस ऑर्डर को उसी बॉक्स में भेजने के लिए, आइटम भेजते समय "#${number} वाला बॉक्स" चुनें।`
        : `ट्रैकिंग नंबर ${waybill} ऑर्डर #${number} पर इस्तेमाल हो चुका है। इस ऑर्डर के लिए नया ट्रैकिंग नंबर डालें।`,
  }),
]
