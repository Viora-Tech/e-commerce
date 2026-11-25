/** Hindi overlay for checkout's repeated-checkout words (`data/checkout-repeat.ts`): keys left out read in English. */
import type { checkoutRepeatContent } from '../checkout-repeat'

export const checkoutRepeatContentHi: Partial<typeof checkoutRepeatContent> = {
  tooMany:
    'पिछले एक घंटे में आपने कुछ ऑर्डर शुरू किए, पर उनका भुगतान नहीं हुआ। कृपया उनमें से किसी एक का भुगतान करें, या एक घंटे बाद फिर कोशिश करें।',
  latestOrder: 'मेरा बिना भुगतान वाला पिछला ऑर्डर खोलें',
}
