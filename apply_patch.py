#!/usr/bin/env python3
"""
Run this on your mock index machine:
  python3 apply_patch.py index.js
It will patch index.js in-place and create index.js.bak as backup.
"""
import re, sys, shutil

if len(sys.argv) < 2:
    print("Usage: python3 apply_patch.py index.js")
    sys.exit(1)

path = sys.argv[1]
shutil.copy(path, path + '.bak')
print(f"Backup saved to {path}.bak")

code = open(path, encoding='utf-8').read()

# Patch 1–4: All order.order_status = 'SHIPPED' assignments → PROCESSED
# (covers demo/ship_order, logistics/ship_order, init_shipment, download_shipping_document)
n1 = len(re.findall(r"order\.order_status = 'SHIPPED'", code))
code = re.sub(r"order\.order_status = 'SHIPPED'", "order.order_status = 'PROCESSED'", code)
print(f"✅ Patch 1–4: {n1} assignment(s) changed — order_status SHIPPED → PROCESSED")

# Patch 5: UI isShipped comparison — also match PROCESSED so UI shows correctly
n2 = len(re.findall(r"o\.order_status === 'SHIPPED'", code))
code = re.sub(
    r"o\.order_status === 'SHIPPED'",
    "(o.order_status === 'SHIPPED' || o.order_status === 'PROCESSED')",
    code
)
print(f"✅ Patch 5: {n2} UI comparison(s) updated — isShipped now includes PROCESSED")

open(path, 'w', encoding='utf-8').write(code)
print(f"\n✅ Done. {path} patched successfully.")
print("Restart your mock index to apply changes.")