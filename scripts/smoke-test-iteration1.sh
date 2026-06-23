#!/usr/bin/env bash
set -eu
TOKEN=$(curl -sk -X POST https://localhost/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"demo1234"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["accessToken"])')
echo "TOKEN_LEN=${#TOKEN}"

echo
echo '=== recent-activity ==='
curl -sk -H "Authorization: Bearer $TOKEN" https://localhost/api/v1/me/recent-activity

echo
echo '=== metrics/admin ==='
curl -sk -H "Authorization: Bearer $TOKEN" https://localhost/api/v1/metrics/admin \
  | python3 -m json.tool | head -30

echo
echo '=== clients ==='
curl -sk -H "Authorization: Bearer $TOKEN" 'https://localhost/api/v1/clients?size=10' \
  | python3 -c '
import sys, json
d = json.load(sys.stdin)
print("total", d["totalElements"])
for c in d["content"]:
    tags = [t["name"] for t in c.get("tags", [])]
    print(c["name"], c["phone"], tags)
'
