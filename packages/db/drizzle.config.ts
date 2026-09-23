import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: [
    './src/schema.ts',
    './src/auth-schema.ts',
    './src/marketing-schema.ts',
    // Installable apps that own tables. Their migrations join the one chain here.
    '../plugin-gst-invoices/src/schema.ts',
  ],
  out: './drizzle',
  casing: 'snake_case',
})
