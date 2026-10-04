#!/usr/bin/env bash
# Build + deploy BattleChan to Solana TESTNET and initialize it.
# Requires: solana CLI (Agave 2.x), anchor 0.31.1, node 18+, a funded testnet wallet.
set -euo pipefail
cd "$(dirname "$0")/.."

WALLET="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}"
CLUSTER_URL="https://api.testnet.solana.com"

solana config set --url "$CLUSTER_URL" --keypair "$WALLET" >/dev/null
echo "Wallet:  $(solana address)"
echo "Balance: $(solana balance)"
echo "Need ~6 SOL for deploy. Testnet faucet: https://faucet.solana.com  (or: solana airdrop 2)"

# Keep the program id in sync with target/deploy/battlechan-keypair.json
anchor keys sync
anchor build
anchor deploy --provider.cluster testnet --provider.wallet "$WALLET"

# Copy IDL for the frontend
mkdir -p app/src/idl
cp target/idl/battlechan.json app/src/idl/battlechan.json

npm install --no-audit --no-fund
ANCHOR_PROVIDER_URL="$CLUSTER_URL" ANCHOR_WALLET="$WALLET" npx ts-node scripts/init.ts

echo
echo "Next: cd app && cp .env.example .env && npm install && npm run dev"
