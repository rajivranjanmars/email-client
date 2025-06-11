#!/bin/bash

# SSL Certificate Generation Script
# This script generates self-signed certificates for development/testing

SSL_DIR="mail-server/dovecot/ssl"
DOMAIN="localhost"

echo "🔐 Generating SSL certificates for mail server..."

# Create SSL directory if it doesn't exist
mkdir -p "$SSL_DIR"

# Generate private key
openssl genrsa -out "$SSL_DIR/dovecot.key" 2048

# Generate certificate signing request
openssl req -new -key "$SSL_DIR/dovecot.key" -out "$SSL_DIR/dovecot.csr" -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"

# Generate self-signed certificate
openssl x509 -req -days 365 -in "$SSL_DIR/dovecot.csr" -signkey "$SSL_DIR/dovecot.key" -out "$SSL_DIR/dovecot.pem"

# Set appropriate permissions
chmod 600 "$SSL_DIR/dovecot.key"
chmod 644 "$SSL_DIR/dovecot.pem"

# Remove CSR file
rm "$SSL_DIR/dovecot.csr"

echo "✅ SSL certificates generated successfully!"
echo "   Private key: $SSL_DIR/dovecot.key"
echo "   Certificate: $SSL_DIR/dovecot.pem"
echo ""
echo "⚠️  These are self-signed certificates for development only."
echo "   For production, use certificates from a trusted CA."
