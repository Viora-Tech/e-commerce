import { themeEditorAppsContent } from '@/data/theme-editor-apps'
import { translation } from '@/lib/i18n'

export default [
  translation(themeEditorAppsContent, {
    missingBlock: (name: string) => `ऐप ब्लॉक: ${name} (उपलब्ध नहीं)`,
    importedEmbeds: 'आपकी Shopify थीम से',
    importedEmbedsNote:
      'वे ऐप एम्बेड जो थीम में Shopify पर थे। ये थीम में बने रहते हैं; जिनका ऐप हमारे पास है, उन्हें वही ऐप दिखाता है।',
    embedOurs: (app: string) => `${app} दिखाता है`,
    embedMissing: 'उपलब्ध नहीं',
    embedOff: 'थीम में बंद',
    scripts: 'चलता हुआ प्रीव्यू',
    scriptsStop: 'एडिटिंग पर वापस',
    scriptsOn:
      'चलता हुआ प्रीव्यू: पेज को आपकी थीम की अपनी स्क्रिप्ट के साथ देखें, ताकि स्लाइडर, टैब और मेन्यू स्टोर की तरह चलें।',
    scriptsOff: 'एडिटिंग कैनवस पर वापस जाएँ।',
    scriptsNote:
      'पेज स्क्रिप्ट के साथ दिख रहा है। किसी सेक्शन को एडिट करने के लिए उस पर क्लिक करें। बिना सेव की थीम सेटिंग्स सेव के बाद दिखेंगी।',
    scriptsFrame: 'थीम स्क्रिप्ट के साथ स्टोर पेज',
  }),
]
