"""One-off codemod: puts `can(permissions.X)` on every store procedure.

Kept in the repo so the mapping is reviewable in the PR diff; it is not wired
into any script and can be deleted once the routers are stable.
"""

import re
import sys

MAP = {
    "analytics": {
        "overview": "ANALYTICS_READ",
        "live": "ANALYTICS_READ",
        "reports": "ANALYTICS_READ",
        "report": "ANALYTICS_READ",
    },
    "apps": {
        "list": "SETTINGS_READ",
        "install": "APPS_MANAGE",
        "uninstall": "APPS_MANAGE",
    },
    "customers": {
        "list": "CUSTOMERS_READ",
        "stats": "CUSTOMERS_READ",
        "tags": "CUSTOMERS_READ",
        "export": "CUSTOMERS_READ",
        "get": "CUSTOMERS_READ",
        "update": "CUSTOMERS_WRITE",
        "delete": "CUSTOMERS_DELETE",
        "tagMany": "CUSTOMERS_WRITE",
        "segments": "CUSTOMERS_READ",
        "segment": "CUSTOMERS_READ",
        "saveSegment": "CUSTOMERS_WRITE",
        "deleteSegment": "CUSTOMERS_WRITE",
        "previewSegment": "CUSTOMERS_READ",
    },
    "dashboard": {"summary": "ANALYTICS_READ"},
    "discounts": {
        "list": "DISCOUNTS_READ",
        "stats": "DISCOUNTS_READ",
        "get": "DISCOUNTS_READ",
        "create": "DISCOUNTS_WRITE",
        "update": "DISCOUNTS_WRITE",
        "toggle": "DISCOUNTS_WRITE",
        "delete": "DISCOUNTS_WRITE",
    },
    "media": {
        "presign": "CONTENT_WRITE",
        "confirm": "CONTENT_WRITE",
        "list": "CONTENT_READ",
        "update": "CONTENT_WRITE",
        "delete": "CONTENT_WRITE",
    },
    "orders": {
        "list": "ORDERS_READ",
        "stats": "ORDERS_READ",
        "get": "ORDERS_READ",
        "neighbours": "ORDERS_READ",
        "fulfil": "ORDERS_FULFIL",
        "collectPayment": "ORDERS_WRITE",
        "createShipment": "ORDERS_FULFIL",
        "refreshTracking": "ORDERS_READ",
        "cancelShipment": "ORDERS_FULFIL",
        "setStatus": "ORDERS_WRITE",
        "refund": "ORDERS_REFUND",
        "addNote": "ORDERS_WRITE",
        "setTags": "ORDERS_WRITE",
        "listDrafts": "DRAFTS_READ",
        "getDraft": "DRAFTS_READ",
        "saveDraft": "DRAFTS_WRITE",
        "deleteDraft": "DRAFTS_WRITE",
        "sendInvoice": "DRAFTS_WRITE",
        "convertDraft": "DRAFTS_WRITE",
        "listAbandoned": "ORDERS_READ",
        "abandonedStats": "ORDERS_READ",
        "sendRecovery": "ORDERS_WRITE",
    },
    "pages": {
        "list": "ONLINE_STORE_READ",
        "get": "ONLINE_STORE_READ",
        "create": "ONLINE_STORE_WRITE",
        "saveDraft": "ONLINE_STORE_WRITE",
        "publish": "ONLINE_STORE_PUBLISH",
        "delete": "ONLINE_STORE_WRITE",
    },
    "products": {
        "list": "PRODUCTS_READ",
        "stats": "PRODUCTS_READ",
        "adjustments": "INVENTORY_READ",
        "get": "PRODUCTS_READ",
        "facets": "PRODUCTS_READ",
        "searchVariants": "PRODUCTS_READ",
        "save": "PRODUCTS_WRITE",
        "delete": "PRODUCTS_DELETE",
        "bulk": "PRODUCTS_WRITE",
        "duplicate": "PRODUCTS_WRITE",
        "exportRows": "PRODUCTS_READ",
        "previewImport": "PRODUCTS_IMPORT",
        "import": "PRODUCTS_IMPORT",
        "generateHandle": "PRODUCTS_READ",
        "update": "PRODUCTS_WRITE",
        "updateVariant": "INVENTORY_WRITE",
    },
    "store": {
        "current": "SETTINGS_READ",
        "getGeneral": "SETTINGS_READ",
        "updateGeneral": "SETTINGS_MANAGE",
        "updateTheme": "SETTINGS_MANAGE",
        "getPayments": "SETTINGS_READ",
        "updatePayments": "SETTINGS_MANAGE",
        "getNotifications": "SETTINGS_READ",
        "updateNotifications": "SETTINGS_MANAGE",
        "getShipping": "SETTINGS_READ",
        "updateShipping": "SETTINGS_MANAGE",
        "estimateDelivery": "SETTINGS_READ",
        "verifyShipping": "SETTINGS_READ",
        "getStorage": "SETTINGS_READ",
        "updateStorage": "SETTINGS_MANAGE",
        "verifyStorage": "SETTINGS_READ",
    },
}


def main() -> int:
    total = 0
    for router, procedures in MAP.items():
        path = f"packages/api/src/routers/{router}.ts"
        with open(path, encoding="utf-8") as handle:
            source = handle.read()
        for name, const in procedures.items():
            pattern = re.compile(rf"^(  {re.escape(name)}: )storeProcedure", re.M)
            source, n = pattern.subn(rf"\1can(permissions.{const})", source)
            if n == 0:
                print(f"  MISS {router}.{name}")
            total += n
        left = len(re.findall(r"^  \w+: storeProcedure", source, re.M))
        if left:
            print(f"  {left} untouched in {router}")
        with open(path, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(source)
    print(f"rewrote {total} procedures")
    return 0


if __name__ == "__main__":
    sys.exit(main())
