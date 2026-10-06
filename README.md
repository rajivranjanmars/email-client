# Multi-Domain Email Server

A completely generic, domain-agnostic email server built with modern technology stack: **Postfix + Dovecot + OpenDKIM + PostgreSQL + Bun + Hono + TypeScript**.

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Git

### Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd email-client
   ```

2. **Run the setup script**
   ```bash
   ./scripts/setup-dev.sh
   ```

3. **Configure your environment**
   ```bash
   # Edit the .env file with your settings
   nano .env
   
   # Update database credentials in Dovecot
   nano mail-server/dovecot/dovecot-sql.conf.ext
   
   # Update database credentials in Postfix
   nano mail-server/postfix/pgsql-*.cf
   ```

4. **Start the services**
   ```bash
   docker-compose up -d
   ```

5. **Check the status**
   ```bash
   docker-compose ps
   docker-compose logs -f
   ```

## 🚀 Modern Tech Stack

- **📧 Mail Server**: Postfix (SMTP) + Dovecot (IMAP/POP3)
- **🔐 Security**: OpenDKIM (anti-spam, DKIM signing)
- **💾 Database**: PostgreSQL (email metadata, accounts)
- **⚡ Runtime**: Bun (faster than Node.js)
- **🌐 API Framework**: Hono (modern, TypeScript-first)
- **🔧 Language**: TypeScript (type safety)
- **🐳 Deployment**: Docker Compose
- **🎨 Frontend**: Next.js (email management UI)

## 🏗️ Architecture

```
email-server/
├── docker-compose.yml         # Full email stack orchestration
├── mail-server/              # Postfix + Dovecot + OpenDKIM configs
│   ├── postfix/
│   ├── dovecot/
│   └── opendkim/
├── api/                      # Bun + Hono TypeScript API
│   ├── src/
│   │   ├── server.ts        # Main Hono server
│   │   ├── routes/          # API routes per domain
│   │   └── services/        # Email service logic
│   └── package.json
├── frontend/                 # Next.js email UI
├── database/                 # PostgreSQL schemas
├── domains/                  # Dynamic domain configs
└── scripts/                  # Management utilities
```

## 🚀 Quick Start

1. **Prerequisites**: Docker, Docker Compose, Bun

2. **Clone and start**:
   ```bash
   bun install
   docker-compose up -d
   bun run dev
   ```

3. **Add your first domain**:
   ```bash
   curl -X POST http://localhost:3000/api/domains \
     -H "Content-Type: application/json" \
     -d '{"domain":"yourdomain.com","mx":"mail.yourdomain.com"}'
   ```

**Note**: The API is accessible directly at `http://localhost:3000` during development. Nginx has been temporarily removed to simplify the development setup.

## 📋 Core Features

- ✅ **Full Email Server** - Production-ready Postfix + Dovecot
- ✅ **Anti-Spam Protection** - OpenDKIM + SPF + DMARC
- ✅ **Zero Hardcoded Domains** - Completely generic
- ✅ **Multi-Domain Support** - Handle unlimited domains
- ✅ **Type Safety** - Full TypeScript implementation
- ✅ **Modern Performance** - Bun runtime + Hono framework
- ✅ **Container-Ready** - Docker Compose deployment
- ✅ **Web Interface** - Next.js email management UI

## ⚙️ Configuration

### Server Configuration (`config/server-config.json`)
Server-level settings (no domain-specific data):
```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0"
  },
  "security": {
    "cors": true,
    "helmet": true
  },
  "logging": {
    "level": "info",
    "file": "logs/server.log"
  }
}
```

### Domain Configuration (Auto-generated per domain)
Each domain gets its own `domains/[domain-name]/config.json`:
```json
{
  "domain": "example.com",
  "smtp": {
    "host": "smtp.example.com",
    "port": 587,
    "secure": false
  },
  "imap": {
    "host": "imap.example.com",
    "port": 993,
    "secure": true
  },
  "accounts": [],
  "created": "2025-05-31T00:00:00.000Z",
  "status": "active"
}
```

## 🌐 API Endpoints

### Domain Management
- `GET /api/domains` - List all domains
- `POST /api/domains` - Create new domain
- `GET /api/domains/:domain` - Get domain details
- `PUT /api/domains/:domain` - Update domain config
- `DELETE /api/domains/:domain` - Remove domain

### Email Operations
- `POST /api/:domain/email/send` - Send email (with CC/BCC)
- `GET /api/:domain/email/inbox` - Get inbox
- `GET /api/:domain/email/sent` - Get sent emails
- `DELETE /api/:domain/email/:id` - Delete email

### Account Management
- `GET /api/:domain/accounts` - List accounts for domain
- `POST /api/:domain/accounts` - Add email account
- `PUT /api/:domain/accounts/:account` - Update account
- `DELETE /api/:domain/accounts/:account` - Remove account

## 🔧 Usage Examples

### Creating a New Domain
```bash
curl -X POST http://localhost:3000/api/domains \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "mycompany.com",
    "smtp": {
      "host": "smtp.mycompany.com",
      "port": 587,
      "secure": false
    },
    "imap": {
      "host": "imap.mycompany.com",
      "port": 993,
      "secure": true
    }
  }'
```

### Adding Email Account
```bash
curl -X POST http://localhost:3000/api/mycompany.com/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "email": "support@mycompany.com",
    "password": "encrypted_password",
    "name": "Support Team"
  }'
```

### Sending Email with CC/BCC
```bash
curl -X POST http://localhost:3000/api/mycompany.com/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "from": "support@mycompany.com",
    "to": ["customer@example.com"],
    "cc": ["manager@mycompany.com"],
    "bcc": ["admin@mycompany.com"],
    "subject": "Welcome!",
    "text": "Welcome to our service!",
    "html": "<h1>Welcome to our service!</h1>"
  }'
```

## 🔄 Adding New Domains

1. **Via API** (Recommended):
   ```bash
   curl -X POST http://localhost:3000/api/domains -d '{"domain":"newdomain.com",...}'
   ```

2. **Via Script**:
   ```bash
   npm run domain:create
   ```

3. **Manual** (Not recommended):
   - Copy `templates/domain-template/` to `domains/newdomain.com/`
   - Edit `domains/newdomain.com/config.json`
   - Restart server

## 🛠️ Development Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload
- `npm run domain:create` - Interactive domain creation
- `npm run domain:list` - List all configured domains
- `npm test` - Run test suite

## 🔐 Security

- All domain configurations are isolated
- Email passwords are encrypted
- CORS and Helmet security enabled
- Input validation on all endpoints
- Rate limiting per domain

## 📝 Logging

- Server logs: `logs/server.log`
- Domain logs: `domains/[domain]/logs/`
- Email operation logs per domain
- Error tracking and debugging

## 🚀 Scaling

- **Horizontal**: Run multiple server instances
- **Vertical**: Handles 100s of domains per instance
- **Database**: Can be extended to use external DB
- **Load Balancing**: Domain-based routing support

## 🤝 Contributing

1. Follow the dev-story.txt tracking approach
2. All code must be domain-agnostic
3. No hardcoded values allowed
4. Update documentation for new features
5. Add tests for new functionality

## 📄 License

MIT License - See LICENSE file for details

## Troubleshooting: Database Authentication Failure

If the API container fails with a `password authentication failed for user "emailuser"` error, ensure that the `POSTGRES_USER` and `POSTGRES_PASSWORD` values in both the `postgres` and `api` services in `docker-compose.yml` match. The default values are:

- POSTGRES_USER: emailuser
- POSTGRES_PASSWORD: emailpass

After correcting, restart the containers with:

```
docker-compose down
# (optional) docker volume rm email-client_postgres_data
# (optional) rm -rf ./database/init.sql if you want to reset DB
# (optional) docker-compose build --no-cache
# Then:
docker-compose up -d
```

## Resetting Postgres Data Volume for Authentication Issues

If you encounter `password authentication failed for user "emailuser"` in the API container logs, you may need to reset the Postgres data volume to clear out old credentials:

1. Stop all containers:
   ```bash
   docker-compose down
   ```
2. Remove the Postgres data volume:
   ```bash
   docker volume rm email-client_postgres_data
   ```
3. (Optional) Remove or edit `./database/init.sql` if you want to reset the schema/data.
4. Start the containers again:
   ```bash
   docker-compose up -d
   ```

This will reinitialize the database with the credentials from `docker-compose.yml`.

## Development Notes

### Nginx Removal (Temporary)
- Nginx has been temporarily removed from the docker-compose setup to eliminate SSL certificate issues during development
- The API server (Bun + Hono) is now accessible directly at `http://localhost:3000`
- This simplifies development and testing of the email server functionality
- Nginx will be re-added later with proper SSL configuration for production deployment

## Author

[Rajiv Ranjan](https://rajivranjan.in)
