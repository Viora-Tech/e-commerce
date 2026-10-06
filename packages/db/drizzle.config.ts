import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: [
    './src/schema.ts',
    './src/ai-schema.ts',
    './src/auth-schema.ts',
    './src/marketing-schema.ts',
    './src/privacy-schema.ts',
    './src/shopper-login-schema.ts',
    './src/store-data-schema.ts',
    // Installable apps that own tables. Their migrations join the one chain here.
    '../plugin-gst-invoices/src/schema.ts',
    '../plugin-shopify-import/src/schema.ts',
    '../plugin-back-in-stock/src/schema.ts',
    '../plugin-forms/src/schema.ts',
  ],
  out: './drizzle',
  casing: 'snake_case',
})
