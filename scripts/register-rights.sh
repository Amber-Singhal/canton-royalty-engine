#!/bin/bash
set -euo pipefail

# ==============================================================================
# Canton Royalty Engine - Rights Registration Script
#
# Description:
#   This script automates the setup of a royalty payment split on a local
#   Canton ledger. It performs the following actions:
#   1. Determines the main package ID of the compiled DAR.
#   2. Allocates necessary parties: Operator, Creator, Collaborator, Publisher.
#   3. Generates a JWT for the Operator to authorize API calls.
#   4. Creates RightsHolder contracts for each content creator/owner.
#   5. Creates a PaymentSplit contract defining the royalty shares for a
#      specific piece of content.
#
# Usage:
#   Ensure a Canton sandbox is running and the project is built.
#   From the project root directory, run:
#   ./scripts/register-rights.sh
#
# Requirements:
#   - dpm (for inspecting the DAR)
#   - curl (for API requests)
#   - jq (for parsing JSON responses)
#   - openssl (for JWT signing)
# ==============================================================================

# --- Configuration ---
readonly JSON_API_URL="http://localhost:7575"
readonly LEDGER_ID="sandbox-ledgers" # Default for `dpm sandbox`
readonly APPLICATION_ID="CantonRoyaltyEngineSetup"
readonly JWT_SECRET="secret" # Use a secure, configured secret in production

# --- Helper Functions ---
function header() {
  echo ""
  echo "--- $1 ---"
}

# Check for required tools
for tool in curl jq openssl dpm; do
  if ! command -v $tool &> /dev/null; then
    echo "Error: Required command '$tool' is not installed. Please install it and try again."
    exit 1
  fi
done

# --- 1. Get Package ID ---
header "Determining Package ID"
DAR_PATH=$(find .daml/dist -name "canton-royalty-engine-*.dar" | head -n 1)
if [ -z "$DAR_PATH" ]; then
  echo "Error: Could not find canton-royalty-engine DAR file in .daml/dist/"
  echo "Please build the project first using 'dpm build'."
  exit 1
fi
MAIN_PACKAGE_ID=$(dpm damlc inspect-dar --json "$DAR_PATH" | jq -r .main_package_id)
echo "Found DAR: $DAR_PATH"
echo "Using Package ID: $MAIN_PACKAGE_ID"

# --- 2. Allocate Parties ---
header "Allocating Parties"
function allocate_party() {
  local display_name=$1
  local hint=$2
  local response
  response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{\"displayName\": \"$display_name\", \"partyIdHint\": \"$hint\"}" \
    "$JSON_API_URL/v2/parties/allocate")

  if echo "$response" | jq -e '.identifier' > /dev/null; then
    echo "$response" | jq -r '.identifier'
  else
    echo "Error allocating party '$display_name': $response" >&2
    exit 1
  fi
}

OPERATOR_PARTY=$(allocate_party "Operator" "operator")
CREATOR_PARTY=$(allocate_party "Creator" "creator")
COLLABORATOR_PARTY=$(allocate_party "Collaborator" "collaborator")
PUBLISHER_PARTY=$(allocate_party "Publisher" "publisher")

echo "Operator Party:     $OPERATOR_PARTY"
echo "Creator Party:      $CREATOR_PARTY"
echo "Collaborator Party: $COLLABORATOR_PARTY"
echo "Publisher Party:    $PUBLISHER_PARTY"

# --- 3. Generate JWT ---
header "Generating JWT for Operator"
function generate_jwt() {
  local parties=("$@")
  local actAs_json
  actAs_json=$(printf '%s\n' "${parties[@]}" | jq -R . | jq -s .)

  local payload
  payload=$(cat <<EOF
{
  "ledgerId": "$LEDGER_ID",
  "applicationId": "$APPLICATION_ID",
  "actAs": $actAs_json
}
EOF
)
  local header='{"alg": "HS256", "typ": "JWT"}'
  local b64_header=$(echo -n "$header" | base64 | tr '+/' '-_' | tr -d '=')
  local b64_payload=$(echo -n "$payload" | base64 | tr '+/' '-_' | tr -d '=')
  local signature=$(echo -n "$b64_header.$b64_payload" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | base64 | tr '+/' '-_' | tr -d '=')
  echo "$b64_header.$b64_payload.$signature"
}

# The Operator will act on behalf of itself to create the initial setup.
OPERATOR_TOKEN=$(generate_jwt "$OPERATOR_PARTY")
echo "JWT generated successfully."


# --- 4. Create RightsHolder Contracts ---
header "Creating RightsHolder Contracts"
function create_contract() {
  local token=$1
  local template_name=$2
  local payload=$3
  local response

  response=$(curl -s -X POST \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "$JSON_API_URL/v1/create")

  if echo "$response" | jq -e '.result.contractId' > /dev/null; then
    local cid
    cid=$(echo "$response" | jq -r '.result.contractId')
    echo "Successfully created '$template_name' contract: $cid"
  else
    echo "Error creating '$template_name' contract: $response" >&2
    exit 1
  fi
}

# Creator RightsHolder
create_contract "$OPERATOR_TOKEN" "RightsHolder" "$(cat <<EOF
{
  "templateId": "${MAIN_PACKAGE_ID}:RightsHolder:RightsHolder",
  "payload": {
    "operator": "$OPERATOR_PARTY",
    "rightsHolder": "$CREATOR_PARTY"
  }
}
EOF
)"

# Collaborator RightsHolder
create_contract "$OPERATOR_TOKEN" "RightsHolder" "$(cat <<EOF
{
  "templateId": "${MAIN_PACKAGE_ID}:RightsHolder:RightsHolder",
  "payload": {
    "operator": "$OPERATOR_PARTY",
    "rightsHolder": "$COLLABORATOR_PARTY"
  }
}
EOF
)"

# Publisher RightsHolder
create_contract "$OPERATOR_TOKEN" "RightsHolder" "$(cat <<EOF
{
  "templateId": "${MAIN_PACKAGE_ID}:RightsHolder:RightsHolder",
  "payload": {
    "operator": "$OPERATOR_PARTY",
    "rightsHolder": "$PUBLISHER_PARTY"
  }
}
EOF
)"

# --- 5. Create PaymentSplit Contract ---
header "Creating PaymentSplit Contract"
CONTENT_ID="SONG-CANTON-BLUES-123"
DESCRIPTION="Royalty Split for 'Canton Blues'"

# The sum of percentages must be "1.0".
PAYMENT_SPLIT_PAYLOAD=$(cat <<EOF
{
  "templateId": "${MAIN_PACKAGE_ID}:PaymentSplit:PaymentSplit",
  "payload": {
    "operator": "$OPERATOR_PARTY",
    "contentId": "$CONTENT_ID",
    "description": "$DESCRIPTION",
    "shares": [
      { "rightsHolder": "$CREATOR_PARTY", "percentage": "0.50" },
      { "rightsHolder": "$COLLABORATOR_PARTY", "percentage": "0.25" },
      { "rightsHolder": "$PUBLISHER_PARTY", "percentage": "0.25" }
    ]
  }
}
EOF
)

create_contract "$OPERATOR_TOKEN" "PaymentSplit" "$PAYMENT_SPLIT_PAYLOAD"

# --- Completion ---
header "Setup Complete"
echo "Successfully registered rights holders and created a payment split for content '$CONTENT_ID'."
echo "You can now start reporting usage against this content."
echo ""