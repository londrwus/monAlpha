#!/bin/bash
# Deployment script for monAlpha — run on your Ubuntu server
# Usage: bash deploy.sh

set -e

APP_DIR="/home/youruser/monalpha/skillmarket"
REPO_DIR="/home/youruser/monalpha"

echo "=== Deploying monAlpha ==="

# Pull latest code
echo "[1/5] Pulling latest code..."
cd "$REPO_DIR"
git pull origin main

# Install dependencies
echo "[2/5] Installing dependencies..."
cd "$APP_DIR"
npm ci

# Build
echo "[3/5] Building Next.js app..."
npm run build

# Restart app with PM2
echo "[4/5] Restarting app..."
pm2 restart monalpha 2>/dev/null || pm2 start npm --name "monalpha" -- start
pm2 save

echo "[5/5] Done!"
echo ""
pm2 status monalpha
echo ""
echo "=== Deploy complete ==="
