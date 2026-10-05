#!/usr/bin/env bash
# Build + deploy BattleChan to Solana DEVNET and initialize it.
# Requires: solana CLI (Agave 2.x), anchor 0.31.1, node 18+, a funded devnet wallet.
#
#   Funding the CLI wallet (no web/CAPTCHA needed):
#     solana airdrop 5 <WALLET> --url devnet
#     # fallback if CLI airdrop is rate-limited:
#     #   - wait, OR use a proof-of-work faucet: devnet-pow (cargo install devnet-pow)
#     #   - real devnet SOL lives in a wallet that holds SOL -> transfer from it
set -euo pipefail
cd "$(dirname "$0")/.."

WALLET="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}"
CLUSTER_URL="https://api.devnet.solana.com"

solana config set --url "$CLUSTER_URL" --keypair "$WALLET" >/dev/null
echo "Wallet:  $(solana address)"
echo "Balance: $(solana balance)"
echo "Need ~6 SOL for deploy. Devnet faucet: https://faucet.solana.com (2 per 8h) or: solana airdrop 5"

# Keep the program id in sync with target/deploy/battlechan-keypair.json
anchor keys sync
anchor build
anchor deploy --provider.cluster devnet --provider.wallet "$WALLET"

# Copy fresh IDL for the frontend
mkdir -p app/src/idl
cp target/idl/battlechan.json app/src/idl/battlechan.json

# Init on-chain state (config, $TIME/$KARMA mints, categories, admin profile)
ANCHOR_PROVIDER_URL="$CLUSTER_URL" ANCHOR_WALLET="$WALLET" npx ts-node scripts/init.ts

# Point the frontend at devnet
sed -i '' 's/^VITE_CLUSTER=.*/VITE_CLUSTER=devnet/; s#^VITE_RPC=.*#VITE_RPC=https://api.devnet.solana.com#' app/.env.example
cp app/.env.example app/.env 2>/dev/null || true

echo
echo "== Deployment complete =="
echo "Program: FB7wxgXLa3ryZiLMuPDs5iZ4WcQcHd3bgjMhbXJnzeGk (from target/deploy/battlechan-keypair.json)"
echo "Next: cd app && npm install && npm run build && redeploy to Vercel (see HANDOVER.md §6)"
