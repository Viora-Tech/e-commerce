/** SOURCE OF TRUTH: the merchant's own email branding — WHAT: logo, logo size, accent and button text colour set once for every notification email (Settings → Notifications → Email branding), over what the live theme gives / WHY: Shopify's "Customize email templates"; one place so every email changes together (owner, 22 Nov 2026) */
import { emailTemplateDesign, type StoreTx } from '@commerce/db'
import type { EmailBrandInfo } from '@commerce/notifications'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

/**
 * Stored as one row of `email_template_design` under this key, beside the per-email designs: no
 * template id starts with an underscore, so it never reads as an email's design.
 */
export const EMAIL_BRANDING_KEY = '_branding'

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/)

/** What the merchant set; anything left out comes from the live theme. */
export const EmailBrandingSchema = z.object({
  logoUrl: z.url().max(2000).nullable().optional(),
  /** Logo width in px, as the theme's logo width (60-320). */
  logoWidth: z.number().int().min(60).max(320).optional(),
  /** Buttons and links. */
  colour: hex.optional(),
  /** The text on buttons. */
  onColour: hex.optional(),
})

export type EmailBranding = z.infer<typeof EmailBrandingSchema>

/** The saved branding, or null when the emails follow the theme (or the row is broken). */
export async function savedEmailBranding(
  tx: StoreTx,
  storeId: string,
): Promise<EmailBranding | null> {
  const [row] = await tx
    .select({ design: emailTemplateDesign.design })
    .from(emailTemplateDesign)
    .where(
      and(
        eq(emailTemplateDesign.storeId, storeId),
        eq(emailTemplateDesign.template, EMAIL_BRANDING_KEY),
      ),
    )
  if (!row) return null
  const parsed = EmailBrandingSchema.safeParse(row.design)
  return parsed.success ? parsed.data : null
}

export async function saveEmailBranding(
  tx: StoreTx,
  storeId: string,
  branding: EmailBranding,
  by: string | null,
): Promise<void> {
  await tx
    .insert(emailTemplateDesign)
    .values({ storeId, template: EMAIL_BRANDING_KEY, design: branding, updatedBy: by })
    .onConflictDoUpdate({
      target: [emailTemplateDesign.storeId, emailTemplateDesign.template],
      set: { design: branding, updatedBy: by, updatedAt: new Date() },
    })
}

/** Back to the theme's look: the row goes. */
export async function resetEmailBranding(tx: StoreTx, storeId: string): Promise<void> {
  await tx
    .delete(emailTemplateDesign)
    .where(
      and(
        eq(emailTemplateDesign.storeId, storeId),
        eq(emailTemplateDesign.template, EMAIL_BRANDING_KEY),
      ),
    )
}

/**
 * The theme's look with the merchant's branding on top. A logo of their own drops the theme's
 * dark-background logo (it would be a different picture); `logoUrl: null` means no logo at all.
 */
export function applyEmailBranding(
  brand: EmailBrandInfo,
  branding: EmailBranding | null,
): EmailBrandInfo {
  if (!branding) return brand
  const ownLogo = branding.logoUrl !== undefined
  return {
    ...brand,
    ...(ownLogo ? { logoUrl: branding.logoUrl, logoDarkUrl: null } : {}),
    ...(branding.logoWidth !== undefined ? { logoWidth: branding.logoWidth } : {}),
    ...(branding.colour ? { colour: branding.colour } : {}),
    ...(branding.onColour ? { onColour: branding.onColour } : {}),
  }
}
