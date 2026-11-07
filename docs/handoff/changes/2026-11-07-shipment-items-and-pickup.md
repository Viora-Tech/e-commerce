# Create shipment: the items and the pickup place say more

The Package card lists each item with its picture, name, SKU, price, weight and quantity, instead of one muted line, so the right items go in the box. `shipments.prepare` now returns those fields on each parcel line.

A pickup place with no street address now shows the name and PIN code we do have, above the link to add the address, instead of the link alone.

In the order page's More actions, Cancel shipment now sits below View order status page. It is red there and in the orders list menu, like Cancel order.
