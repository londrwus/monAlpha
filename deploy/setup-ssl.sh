#!/bin/bash
# SSL Setup Script
# Run this AFTER nginx is installed and DNS is pointed to your server IP
#
# Required env vars:
#   DOMAIN — your domain (e.g. monalpha.xyz)
#   EMAIL  — email for Let's Encrypt notifications

set -e

DOMAIN="${DOMAIN:?Set DOMAIN env var (e.g. monalpha.xyz)}"
EMAIL="${EMAIL:?Set EMAIL env var (e.g. admin@monalpha.xyz)}"

echo "=== SSL Setup for $DOMAIN ==="

# Install certbot
echo "[1/4] Installing certbot..."
apt update
apt install -y certbot python3-certbot-nginx

# Temporarily allow HTTP for ACME challenge
echo "[2/4] Setting up temporary nginx config for SSL verification..."
cat > /etc/nginx/sites-available/$DOMAIN <<TMPCONF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
TMPCONF

ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Get SSL certificate
echo "[3/4] Obtaining SSL certificate..."
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email "$EMAIL" --redirect

echo "[4/4] Done!"
echo ""
echo "=== SSL Setup Complete ==="
echo "  https://$DOMAIN should now be live"
echo "  Certificates auto-renew via systemd timer"
