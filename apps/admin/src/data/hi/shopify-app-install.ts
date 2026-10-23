import { siteConfig } from '@commerce/config/site'
import { shopifyAppInstallContent } from '@/data/shopify-app-install'
import { translation } from '@/lib/i18n'

export default [
  translation(shopifyAppInstallContent, {
    badge: 'एक क्लिक',
    stepsHeading: `Shopify पर ${siteConfig.brand.name} ऐप इंस्टॉल करें`,
    steps: [
      'अपने Shopify स्टोर का पता लिखें और इंस्टॉल दबाएं।',
      'Shopify ऐप और उसकी सिर्फ़ पढ़ने वाली अनुमतियाँ दिखाएगा। वहाँ इंस्टॉल दबाएं।',
      'आप यहाँ जुड़े हुए लौटेंगे, फिर चुनें कि क्या लाना है।',
    ],
    note: 'ऐप सिर्फ़ पढ़ता है। यह आपके Shopify स्टोर में कुछ नहीं बदलता, और आप इसे कभी भी Shopify (Settings, Apps) से हटा सकते हैं।',
    formHeading: 'आपका Shopify स्टोर',
    submit: 'इंस्टॉल करें',
    redirecting: 'Shopify खुल रहा है…',
    failed: 'इंस्टॉल शुरू नहीं हो पाया। पता जाँचें और फिर कोशिश करें।',
    result: {
      connected: `${siteConfig.brand.name} ऐप से Shopify स्टोर जुड़ गया`,
      failed: 'Shopify ने इंस्टॉल पूरा नहीं किया। फिर कोशिश करें।',
      cancelled: 'इंस्टॉल रद्द हो गया।',
    },
  }),
]
