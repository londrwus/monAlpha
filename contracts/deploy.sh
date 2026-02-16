#!/bin/bash
# Deploy SkillRegistry to Monad Testnet
# Usage: bash deploy.sh <PRIVATE_KEY>

set -e

if [ -z "$1" ]; then
  echo "Usage: bash deploy.sh <PRIVATE_KEY>"
  echo "  Get testnet MON from https://testnet.monad.xyz"
  exit 1
fi

PRIVATE_KEY=$1

echo "=== Deploying SkillRegistry to Monad Testnet ==="

forge script script/Deploy.s.sol:DeploySkillRegistry \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --rpc-url https://testnet-rpc.monad.xyz \
  --chain-id 10143 \
  -vvv

echo ""
echo "=== Deploy complete ==="
echo "Copy the contract address from above and set it in your .env:"
echo "  NEXT_PUBLIC_SKILL_REGISTRY=0x..."
echo ""
echo "To verify on Sourcify:"
echo "  forge verify-contract <CONTRACT_ADDRESS> src/SkillRegistry.sol:SkillRegistry \\"
echo "    --chain 10143 \\"
echo "    --verifier sourcify \\"
echo "    --verifier-url https://sourcify-api-monad.blockvision.org/"
echo ""
echo "To verify on Monadscan:"
echo "  forge verify-contract <CONTRACT_ADDRESS> src/SkillRegistry.sol:SkillRegistry \\"
echo "    --chain 10143 \\"
echo "    --verifier etherscan \\"
echo "    --etherscan-api-key <YOUR_API_KEY> \\"
echo "    --watch"
