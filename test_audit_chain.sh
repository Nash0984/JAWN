#!/bin/bash

echo "🔐 Testing Immutable Audit Log Chain"
echo "======================================"
echo

# Get CSRF token first
echo "0. Getting CSRF token..."
CSRF_RESPONSE=$(curl -s http://localhost:5000/api/csrf-token -c cookies.txt)
CSRF_TOKEN=$(echo $CSRF_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "CSRF Token: ${CSRF_TOKEN:0:20}..."
echo

# Login as admin user
echo "1. Logging in as demo.admin..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{"username": "demo.admin", "password": "demo123"}' \
  -b cookies.txt -c cookies.txt)

if echo "$LOGIN_RESPONSE" | grep -q '"error"'; then
  echo "❌ Login failed: $LOGIN_RESPONSE"
  exit 1
fi
echo "✅ Login successful"
echo

# Get audit statistics
echo "2. Getting audit log statistics..."
STATS_RESPONSE=$(curl -s http://localhost:5000/api/audit/statistics -b cookies.txt)
echo "$STATS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$STATS_RESPONSE"
echo

# Verify recent entries (last 10)
echo "3. Verifying recent 10 audit entries..."
VERIFY_RECENT=$(curl -s "http://localhost:5000/api/audit/verify-recent?count=10" -b cookies.txt)
echo "$VERIFY_RECENT" | python3 -m json.tool 2>/dev/null || echo "$VERIFY_RECENT"
echo

# Cleanup
rm -f cookies.txt

echo "======================================"
echo "✅ Audit chain testing complete"
