import {
  CheckoutSettingsSchema,
  loadCheckoutSettings,
  PaymentAdjustmentSchema,
  permissions,
  saveCheckoutSettings,
} from '@commerce/core'
import { loadPincodeDirectory } from '@commerce/shipping/pincode-directory'
import { z } from 'zod'
import { can } from '../procedures'

/** Whether PIN code autofill has its data file on this deployment; a broken file counts as missing. */
async function pincodeDirectoryInstalled(): Promise<boolean> {
  try {
    return (await loadPincodeDirectory()) !== null
  } catch {
    return false
  }
}

/** Settings → Checkout: contact fields, minimum order and cash on delivery rules. */
export const checkoutSettingsRouter = {
  get: can(permissions.SETTINGS_READ).handler(async ({ context }) => ({
    ...(await loadCheckoutSettings({ tx: context.tx, storeId: context.scope.storeId })),
    pincodeDirectory: await pincodeDirectoryInstalled(),
  })),

  save: can(permissions.SETTINGS_MANAGE)
    .input(
      z.object({
        settings: CheckoutSettingsSchema,
        /** The cash on delivery fee, shared with Settings → Payments; null removes it. */
        codFee: PaymentAdjustmentSchema.nullable().optional(),
      }),
    )
    .handler(async ({ context, input }) => ({
      ...(await saveCheckoutSettings(
        { tx: context.tx, storeId: context.scope.storeId },
        input.codFee === undefined
          ? { settings: input.settings }
          : { settings: input.settings, codFee: input.codFee },
      )),
      pincodeDirectory: await pincodeDirectoryInstalled(),
    })),
}
