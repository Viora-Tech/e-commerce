import { z } from 'zod'

/** An approved WhatsApp template chosen for a broadcast or an automation step. */
export const WhatsappTemplateRefSchema = z.object({
  name: z.string().trim().min(1).max(512),
  language: z.string().trim().min(1).max(15),
  /** One value per {{n}} placeholder, in order; may hold merge tags like {first_name}. */
  variables: z.array(z.string().max(1000)).max(20).default([]),
})
export type WhatsappTemplateRef = z.infer<typeof WhatsappTemplateRefSchema>

/** Fills {{1}}, {{2}} in a template body with the chosen values, for the picker's preview. */
export function previewWhatsappBody(body: string, variables: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (whole, n: string) => {
    const v = variables[Number(n) - 1]
    return v?.trim() ? v : whole
  })
}
