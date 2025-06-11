# Security Notice

## Sensitive Files Removed

The following sensitive files have been removed from the repository for security:

- `setup-test-accounts.sql` - Contains test database records
- `test-smtp.js` - Test scripts with hardcoded credentials  
- `dev-story.txt` - Development notes with sensitive information
- `mail-server/dovecot/ssl/` - SSL certificates and private keys
- Hardcoded passwords in configuration files

## Template Files Created

Template files have been created for sensitive configurations:

- `.env.example` - Environment variables template
- `mail-server/dovecot/dovecot-sql.conf.ext.template` - Dovecot SQL config template
- `mail-server/postfix/pgsql-*.cf.template` - Postfix database config templates

## Setup Scripts

- `scripts/setup-dev.sh` - Development environment setup
- `scripts/generate-ssl-certs.sh` - SSL certificate generation

## Important Security Notes

1. **Never commit real credentials** to the repository
2. **Use environment variables** for sensitive configuration
3. **Generate new SSL certificates** for each deployment
4. **Use strong passwords** for database and email accounts
5. **Keep database credentials secure** and rotate them regularly

## Before Going to Production

1. Replace self-signed SSL certificates with CA-signed certificates
2. Use strong, unique passwords for all accounts
3. Enable SSL/TLS for all connections
4. Configure proper firewall rules
5. Set up monitoring and logging
6. Regular security updates and patches
