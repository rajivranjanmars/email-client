#!/bin/bash

# Development Setup Script
# This script sets up the development environment for the email client

echo "🚀 Setting up Email Client Development Environment..."

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created. Please edit it with your configuration."
fi

# Generate SSL certificates if they don't exist
if [ ! -f "mail-server/dovecot/ssl/dovecot.key" ]; then
    echo "🔐 Generating SSL certificates..."
    ./scripts/generate-ssl-certs.sh
fi

# Copy SQL configuration template if needed
if [ ! -f "mail-server/dovecot/dovecot-sql.conf.ext" ]; then
    echo "📋 Creating dovecot-sql.conf.ext from template..."
    cp mail-server/dovecot/dovecot-sql.conf.ext.template mail-server/dovecot/dovecot-sql.conf.ext
    echo "✅ SQL configuration created. Update with your database credentials."
fi

# Copy Postfix configuration templates if needed
for template in mail-server/postfix/*.cf.template; do
    if [ -f "$template" ]; then
        target="${template%.template}"
        if [ ! -f "$target" ]; then
            echo "📋 Creating $(basename "$target") from template..."
            cp "$template" "$target"
        fi
    fi
done

echo ""
echo "✅ Development environment setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Edit .env with your configuration"
echo "   2. Update database credentials in mail-server/dovecot/dovecot-sql.conf.ext"
echo "   3. Update database credentials in mail-server/postfix/pgsql-*.cf files"
echo "   4. Run: docker-compose up -d"
echo ""
echo "🔧 Available scripts:"
echo "   ./scripts/generate-ssl-certs.sh  - Generate SSL certificates"
echo "   docker-compose up -d             - Start all services"
echo "   docker-compose logs -f           - View logs"
