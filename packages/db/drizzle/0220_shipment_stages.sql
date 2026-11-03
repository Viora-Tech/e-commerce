-- #1056: inbound shipments can be Planned (not shipped yet) and Cancelled.
ALTER TABLE "inbound_shipment" DROP CONSTRAINT "inbound_shipment_status_check";--> statement-breakpoint
ALTER TABLE "inbound_shipment" ADD CONSTRAINT "inbound_shipment_status_check" CHECK ("inbound_shipment"."status" in ('planned', 'in_transit', 'at_port', 'cleared', 'delivered', 'cancelled'));
