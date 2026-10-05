#!/usr/bin/env bash
# MORNING ONE-SHOT: deploy BattleChan program to devnet + init + redeploy frontend.
# Run AFTER the CLI wallet ~/.config/solana/id.json has devnet SOL (see notes below).
# Author: BrowserOS handover, 2026-10-05
set -euo pipefail
cd "$(dirname "$0")/.."

export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.local/node/bin:$HOME/.cargo/bin:$PATH"
WALLET="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}"
URL="https://api.devnet.solana.com"

echo "== 0. Preflight =="
solana config set --url "$URL" --keypair "$WALLET" >/dev/null
ADDR=$(solana address)
echo "Wallet: $ADDR"
echo "Balance: $(solana balance)"   # need >= ~6 SOL

# If balance is low, try CLI airdrop (works when not rate-limited):
#   solana airdrop 5 "$ADDR" --url devnet
echo

echo "== 1. Build program (SBF) =="
anchor keys sync
anchor build

echo
echo "== 2. Deploy program to devnet =="
anchor deploy --provider.cluster devnet --provider.wallet "$WALLET"

echo
echo "== 3. Initialize on-chain state =="
ANCHOR_PROVIDER_URL="$URL" ANCHOR_WALLET="$WALLET" npx ts-node scripts/init.ts

echo
echo "== 4. Rebuild + redeploy frontend =="
mkdir -p app/src/idl && cp target/idl/battlechan.json app/src/idl/battlechan.json
( cd app && cp .env.example .env && npm install --no-audit --no-fund && npm run build )
( cd app/dist && echo '{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}' > vercel.json && npx vercel deploy --prod --yes --name battlechan )

echo
echo "== DONE =="
echo "Program: $ADDR/pkg FB7wxgXLa3ryZiLMuPDs5iZ4WcQcHd3bgjMhbXJnzeGk"
echo "Frontend: https://battlechan.vercel.app"
echo "Explorer: https://explorer.solana.com/address/FB7wxgXLa3ryZiLMuPDs5iZ4WcQcHd3bgjMhbXJnzeGk?cluster=devnet"
