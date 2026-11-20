/** SOURCE OF TRUTH: lost-parcel procedures — WHAT: Mark as lost, Reship and the courier claim on a lost parcel / WHY: kept out of shipments.ts (500-line cap) and spread into `shipmentsRouter`, so the paths are `shipments.markLost`, `shipments.reship` and `shipments.updateClaim` */
import {
  CLAIM_STATUSES,
  InventoryError,
  markShipmentLost,
  permissions,
  reshipLostShipment,
  ShipmentLostRefused,
  updateShipmentClaim,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'

/** A refused step or too little stock for the new box reads as the reason, not a 500. */
const toRpc = (err: unknown): never => {
  if (err instanceof ShipmentLostRefused) {
    throw new ORPCError('PRECONDITION_FAILED', { message: err.message })
  }
  if (err instanceof InventoryError) {
    throw new ORPCError('PRECONDITION_FAILED', {
      message: 'Not enough stock to send this parcel again. Add the stock first, then reship.',
    })
  }
  if (err instanceof Error && err.message === 'shipment not found') throw new ORPCError('NOT_FOUND')
  throw err
}

const byId = z.object({ shipmentId: z.uuid() })

export const lostParcelProcedures = {
  /** "Mark as lost": the courier said so but its feed did not. A parcel the courier has. */
  markLost: can(permissions.ORDERS_FULFIL)
    .input(byId)
    .handler(({ context, input }) =>
      markShipmentLost({ storeId: context.scope.storeId, tx: context.tx }, input.shipmentId, {
        author: context.session.user.email,
      }).catch(toRpc),
    ),

  /** "Reship": the same order back to To ship to book a new label; its items leave stock again. */
  reship: can(permissions.ORDERS_FULFIL)
    .input(byId)
    .handler(({ context, input }) =>
      reshipLostShipment({ storeId: context.scope.storeId, tx: context.tx }, input.shipmentId, {
        author: context.session.user.email,
      }).catch(toRpc),
    ),

  /** The courier claim on a lost parcel: not filed, filed, paid or rejected, its amount and note. */
  updateClaim: can(permissions.ORDERS_FULFIL)
    .input(
      byId.extend({
        status: z.enum(CLAIM_STATUSES),
        amountPaise: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
        note: z.string().trim().max(500).nullable().optional(),
      }),
    )
    .handler(({ context, input }) =>
      updateShipmentClaim(
        { storeId: context.scope.storeId, tx: context.tx },
        input.shipmentId,
        { status: input.status, amountPaise: input.amountPaise, note: input.note },
        { author: context.session.user.email },
      ).catch(toRpc),
    ),
}
