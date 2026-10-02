import { signThemePreviewToken } from './src/theme/preview-token'

const token = signThemePreviewToken({
  secret: process.env.SETTINGS_SECRET as string,
  storeId: '01a0de8f-0350-7522-8375-547613dcae7f',
  themeId: process.argv[2] as string,
})
console.log(`http://localhost:3110/?theme-preview=${encodeURIComponent(token)}`)
