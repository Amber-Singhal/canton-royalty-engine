#!/bin/bash
#
# Description:
#   Submits a sample usage report for a piece of content, which triggers the
#   royalty payout calculation and distribution workflow on the ledger.
#
#   This script performs the following actions:
#   1. Queries the ledger to find an active `Content` contract for the Licensee.
#   2. Constructs and exercises the `ReportUsage` choice on that contract.
#
# Usage:
#   Set the LICENSEE_PARTY_ID and LICENSEE_JWT environment variables, then run:
#   ./scripts/submit-usage.sh
#
# Example:
#   export LICENSEE_PARTY_ID="Licensee::1220..."
#   export LICENSEE_JWT="your-jwt-here"
#   ./scripts/submit-usage.sh
#
# Prerequisites:
#   - A Canton Sandbox is running (use `dpm sandbox`).
#   - A `Content` contract has been created on the ledger for the Licensee.
#   - `jq`, `curl`, and `uuidgen` command-line tools are installed.
#   - A valid JWT for the LICENSEE_PARTY_ID is provided.
#
# JWT Generation for Sandbox:
#   You can generate a token at https://jwt.io. Use 'secret' as the key for
#   the default sandbox configuration.
#   Payload:
#   {
#     "https://daml.com/ledger-api": {
#       "ledgerId": "sandbox",
#       "applicationId": "royalty-engine-app",
#       "actAs": ["<your-licensee-party-id>"]
#     }
#   }
#

set -euo pipefail

# --- Configuration ---
JSON_API_URL=${JSON_API_URL:-"http://localhost:7575"}
CONTENT_TEMPLATE_ID="Content:Content" # Adjust if your Daml module/template name is different

# --- Validate Inputs ---
if [[ -z "${LICENSEE_PARTY_ID:-}" || -z "${LICENSEE_JWT:-}" ]]; then
  echo "Error: LICENSEE_PARTY_ID and LICENSEE_JWT environment variables must be set."
  echo "Usage: export LICENSEE_PARTY_ID=<party_id> LICENSEE_JWT=<jwt>; ./scripts/submit-usage.sh"
  exit 1
fi

# --- Main Script ---
echo "▶️  Submitting Usage Report as Licensee: $LICENSEE_PARTY_ID"
echo "---"

# 1. Find an active Content contract for the Licensee
echo "🔎 Querying for an active '$CONTENT_TEMPLATE_ID' contract..."

QUERY_PAYLOAD=$(printf '{"templateIds": ["%s"]}' "$CONTENT_TEMPLATE_ID")

QUERY_RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $LICENSEE_JWT" \
  -H "Content-Type: application/json" \
  -d "$QUERY_PAYLOAD" \
  "$JSON_API_URL/v1/query")

# Extract the contract ID of the first found contract
CONTENT_CONTRACT_ID=$(echo "$QUERY_RESPONSE" | jq -r '.result[0].contractId')

if [[ -z "$CONTENT_CONTRACT_ID" || "$CONTENT_CONTRACT_ID" == "null" ]]; then
  echo "❌ Error: No active '$CONTENT_TEMPLATE_ID' contract found that is visible to Licensee '$LICENSEE_PARTY_ID'."
  echo "   Please ensure a Content contract has been created with this party as a stakeholder."
  exit 1
fi

echo "✅ Found Content contract: $CONTENT_CONTRACT_ID"
echo "---"

# 2. Prepare and submit the ReportUsage choice
echo "🚀 Exercising 'ReportUsage' choice on contract $CONTENT_CONTRACT_ID..."

# Generate dynamic data for the report
REPORT_ID="report-$(uuidgen)"
REVENUE_AMOUNT="25000.00"
START_DATE=$(date -u -d '3 months ago' '+%Y-%m-%d')
END_DATE=$(date -u '+%Y-%m-%d')

echo "   Report ID:        $REPORT_ID"
echo "   Revenue Amount:   $REVENUE_AMOUNT"
echo "   Usage Period:     $START_DATE to $END_DATE"

EXERCISE_PAYLOAD=$(cat <<EOF
{
  "templateId": "$CONTENT_TEMPLATE_ID",
  "contractId": "$CONTENT_CONTRACT_ID",
  "choice": "ReportUsage",
  "argument": {
    "reportId": "$REPORT_ID",
    "revenueGenerated": "$REVENUE_AMOUNT",
    "usagePeriodStart": "$START_DATE",
    "usagePeriodEnd": "$END_DATE"
  }
}
EOF
)

# 3. Send the exercise command to the JSON API
EXERCISE_RESPONSE=$(curl -s -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $LICENSEE_JWT" \
  -H "Content-Type: application/json" \
  -d "$EXERCISE_PAYLOAD" \
  -o >(cat > /dev/stdout) \
  "$JSON_API_URL/v1/exercise")

HTTP_STATUS=${EXERCISE_RESPONSE: -3}
RESPONSE_BODY=${EXERCISE_RESPONSE::-3}

echo "---"

# 4. Check the response
if [[ "$HTTP_STATUS" -eq 200 ]]; then
  echo "✅ Successfully submitted usage report (HTTP $HTTP_STATUS)."
  echo "   Royalty payout process should now be triggered on the ledger."
  TRANSACTION_ID=$(echo "$RESPONSE_BODY" | jq -r '.result.transactionId')
  echo "   Transaction ID: $TRANSACTION_ID"
else
  echo "❌ Error submitting usage report (HTTP $HTTP_STATUS)."
  echo "   Response Body:"
  echo "$RESPONSE_BODY" | jq .
  exit 1
fi

echo ""
echo "🎉 Done."