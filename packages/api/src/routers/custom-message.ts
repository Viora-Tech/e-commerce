import { z } from 'zod'

/** The subject and note a merchant may edit in the "Review email" dialog before a send. */
export const customMessage = z
  .object({
    subject: z.string().trim().max(200).optional(),
    message: z.string().trim().max(2000).optional(),
  })
  .optional()
