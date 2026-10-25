import { razorpayWebsitesContent } from '@/data/razorpay-websites'
import { translation } from '@/lib/i18n'

export default [
  translation(razorpayWebsitesContent, {
    list: {
      label: 'Razorpay में रजिस्टर करने वाली वेबसाइटें',
      help: 'Razorpay Dashboard में Account & Settings → Website and app details खोलें और इनमें से हर एक जोड़ें। जो वेबसाइट वहाँ नहीं जुड़ी है, उससे आने वाले लाइव पेमेंट Razorpay रोक देता है।',
      empty:
        'आपके स्टोर का अभी कोई लाइव वेब पता नहीं है। लाइव होते ही वह यहाँ दिखेगा, जिसे Razorpay में जोड़ना है।',
    },
    banner: {
      title: 'Razorpay आपकी वेबसाइट से आने वाले पेमेंट रोक रहा है',
      body: (sites: string) =>
        `Razorpay ने एक पेमेंट रोका क्योंकि जिस वेबसाइट से वह आया, वह आपके Razorpay अकाउंट में नहीं जुड़ी है। Razorpay Dashboard में Account & Settings → Website and app details खोलें, ${sites} जोड़ें, फिर दोबारा पेमेंट आज़माएँ।`,
      yourWebsite: 'अपने स्टोर का वेब पता',
      when: (when: string) => `आख़िरी रोका गया पेमेंट: ${when}।`,
      action: 'जोड़ने वाली वेबसाइटें देखें',
    },
    attempt: {
      failedReason: 'क्यों फ़ेल हुआ',
      websiteFix:
        'Razorpay में अपने स्टोर की वेबसाइट जोड़ें (Account & Settings → Website and app details)।',
    },
  }),
]
