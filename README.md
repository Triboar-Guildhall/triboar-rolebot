# Triboar RoleBot

A Discord bot that automates subscription-based access control for the Triboar Guildhall Discord server. It synchronizes paid memberships with Discord roles, manages grace periods, and keeps users informed through direct messages.

## Features

- **Automatic Role Management** - Grants and revokes the `@Subscribed` role based on subscription status
- **Grace Period System** - 7-day grace period with daily reminders for expired subscriptions
- **Direct Message Notifications** - Rich embed messages for subscription status updates
- **Webhook Integration** - Real-time updates from backend payment system
- **Daily Synchronization** - Automated daily sync at 11:59 PM to ensure accuracy
- **DM Preferences** - Users can opt-in/opt-out of notifications by replying "START" or "STOP"
- **Production Ready** - Docker support, health checks, structured logging, and authentication

## Quick Start

Get up and running in 3 steps:

```bash
# 1. Clone and configure
git clone <repository-url>
cd triboar-rolebot
cp .env.example .env
# Edit .env with your Discord tokens and API keys

# 2. Start with Docker (no Node.js installation needed!)
npm run docker:dev

# 3. View logs and start developing!
# Changes to src/ files automatically reload the bot
```

That's it! Continue reading for detailed setup and configuration.

## Prerequisites

- Docker and Docker Compose
- Discord Bot Token with required permissions
- Access to Triboar backend API
- Discord server with Guild ID and Role ID

**Note:** You do NOT need Node.js installed locally - all development is done via Docker containers.

### Required Discord Bot Permissions

- `GUILDS` - Access guild information
- `GUILD_MEMBERS` - Manage member roles
- `DIRECT_MESSAGES` - Send DMs to users
- `MESSAGE_CONTENT` - Read DM replies for opt-in/opt-out

### Required Discord Intents

When creating your bot application on Discord Developer Portal, enable:
- Server Members Intent
- Message Content Intent

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd triboar-rolebot
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration (see Configuration section below)
   ```

3. **Start the bot with Docker**
   ```bash
   npm run docker:dev
   ```

That's it! Docker will handle installing dependencies and running the bot. No need to install Node.js locally.

## Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DISCORD_BOT_TOKEN` | Discord bot authentication token from Discord Developer Portal | `MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.G...` |
| `DISCORD_GUILD_ID` | Discord server (guild) ID where bot operates | `123456789012345678` |
| `DISCORD_SUBSCRIBED_ROLE_ID` | Role ID to manage for subscribed users | `987654321098765432` |
| `BACKEND_API_TOKEN` | API authentication token (minimum 32 characters) | `your-secure-token-min-32-chars` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BACKEND_API_URL` | Base URL for backend API | `http://localhost:3000` |
| `CHECKOUT_URL` | Subscription checkout page URL | `https://triboar.guild/checkout/` |
| `GRACE_PERIOD_DAYS` | Number of days for grace period | `7` |
| `GRACE_PERIOD_DM_ENABLED` | Enable/disable grace period DMs | `true` |
| `DAILY_SYNC_SCHEDULE` | Cron schedule for daily sync | `59 23 * * *` (11:59 PM) |
| `PORT` | Webhook server port | `3001` |
| `LOG_LEVEL` | Logging level (trace, debug, info, warn, error) | `info` |
| `NODE_ENV` | Environment mode (development, production) | `development` |

### Getting Discord IDs

1. **Enable Developer Mode** in Discord: User Settings → Advanced → Developer Mode
2. **Guild ID**: Right-click server icon → Copy Server ID
3. **Role ID**: Server Settings → Roles → Right-click role → Copy Role ID
4. **Bot Token**: [Discord Developer Portal](https://discord.com/developers/applications) → Your Application → Bot → Token

## Development Setup

### Docker-First Development (Recommended)

All development is done via Docker - no need to install Node.js locally!

1. **Configure environment** (if not done during installation)
   ```bash
   cp .env.example .env
   # Edit .env with your Discord tokens and backend API configuration
   ```

2. **Start the bot**
   ```bash
   npm run docker:dev
   ```

3. **The bot is now running!**
   - Logs will stream to your terminal
   - File changes in `src/` automatically trigger reload (via nodemon)
   - Webhook server available at `http://localhost:3001`

### Development Commands

```bash
# Start bot in development mode
npm run docker:dev

# Start bot and rebuild container (use after package.json changes)
npm run docker:dev:build

# Stop the bot
npm run docker:dev:down

# View logs
npm run docker:dev:logs

# Access container shell (for debugging)
npm run docker:dev:shell

# Run linter (inside container)
npm run docker:dev:shell
# Then inside container: npm run lint
```

### Making Code Changes

1. Edit files in the `src/` directory
2. Changes are automatically detected and the bot restarts
3. View logs in your terminal to see the restart

### Adding Dependencies

If you add new packages to `package.json`:

```bash
# Stop and rebuild the container
npm run docker:dev:down
npm run docker:dev:build
```

### Development Workflow with Backend

For full integration testing with the backend API:

1. **Start the backend API** (ensure it's accessible)
   - If running locally, update `BACKEND_API_URL` in `.env` to `http://host.docker.internal:3000`
   - If running in Docker, ensure both are on the same network

2. **Set up ngrok for webhook testing** (optional, for webhook testing)
   ```bash
   # In separate terminal
   ngrok http 3001
   # Update your backend to send webhooks to: https://your-ngrok-url/webhooks/rolebot
   ```

3. **Start the rolebot**
   ```bash
   npm run docker:dev
   ```

### Local Development (Without Docker)

If you prefer to develop without Docker (not recommended):

1. **Install Node.js 22.x or higher**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start bot with hot-reload**
   ```bash
   npm run dev
   ```

4. **Run linter**
   ```bash
   npm run lint
   ```

### Project Structure

```
triboar-rolebot/
├── src/
│   ├── bot.js                 # Main entry point, Discord client setup
│   ├── config.js              # Configuration and environment validation
│   ├── logger.js              # Pino logging configuration
│   ├── middleware.js          # Express middleware (webhook auth)
│   ├── webhookServer.js       # Express webhook server
│   └── services/
│       ├── backendService.js  # Backend API communication
│       ├── dmService.js       # Direct message notifications
│       ├── roleService.js     # Discord role management
│       └── syncService.js     # Subscription synchronization logic
├── Dockerfile                 # Multi-stage build (dev + production targets)
├── docker-compose.yml         # Docker Compose for development
├── .dockerignore              # Docker ignore patterns
├── package.json               # Dependencies and scripts
├── .env.example               # Environment variable template
└── README.md                  # This file
```

## Deployment

### Docker Multi-Stage Build Architecture

The project uses a **single Dockerfile** with multiple build targets:

- **`development`** target - Includes all dependencies and nodemon for hot-reload
- **`production`** target - Optimized with production-only dependencies
- **`production-deps`** target - Intermediate stage for efficient layer caching

### Production Deployment with Docker

The production target creates an optimized image with only production dependencies.

#### Quick Start

1. **Build and run using npm scripts**
   ```bash
   # Build production image
   npm run docker:prod:build

   # Run production container
   npm run docker:prod:run
   ```

2. **Check container status**
   ```bash
   docker ps
   curl http://localhost:3001/health
   ```

3. **View logs**
   ```bash
   docker logs -f triboar-rolebot
   ```

#### Manual Docker Commands

If you prefer to use Docker commands directly:

1. **Build the production image**
   ```bash
   docker build -t triboar-rolebot .
   ```

2. **Run the container**
   ```bash
   docker run -d \
     --name triboar-rolebot \
     --env-file .env \
     -p 3001:3001 \
     --restart unless-stopped \
     triboar-rolebot
   ```

3. **Stop and remove**
   ```bash
   docker stop triboar-rolebot
   docker rm triboar-rolebot
   ```

### Production Deployment with Docker Compose

For production deployments, create a `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  rolebot:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: triboar-rolebot-prod
    restart: unless-stopped
    ports:
      - "3001:3001"
    env_file:
      - .env
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 5s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

Deploy with:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Updating Production Deployment

To update the bot in production:

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build

# Or with manual commands
docker stop triboar-rolebot
docker rm triboar-rolebot
npm run docker:prod:build
npm run docker:prod:run
```

### Deployment to fly.io (Recommended)

fly.io provides excellent support for Dockerized applications with automatic deployments.

#### Initial Setup

1. **Install the flyctl CLI**
   ```bash
   # macOS
   brew install flyctl

   # Linux
   curl -L https://fly.io/install.sh | sh

   # Windows
   iwr https://fly.io/install.ps1 -useb | iex
   ```

2. **Authenticate with fly.io**
   ```bash
   flyctl auth login
   ```

3. **Initialize your app** (run from project root)
   ```bash
   flyctl launch
   ```

   This will:
   - Detect your Dockerfile automatically
   - Create a `fly.toml` configuration file
   - Prompt you to choose a region and app name

4. **Set environment secrets**
   ```bash
   flyctl secrets set DISCORD_BOT_TOKEN=your_token_here
   flyctl secrets set DISCORD_GUILD_ID=your_guild_id
   flyctl secrets set DISCORD_SUBSCRIBED_ROLE_ID=your_role_id
   flyctl secrets set BACKEND_API_TOKEN=your_backend_token
   flyctl secrets set BACKEND_API_URL=https://your-backend.com
   flyctl secrets set CHECKOUT_URL=https://triboar.guild/checkout/
   ```

5. **Deploy**
   ```bash
   flyctl deploy
   ```

#### Example fly.toml Configuration

After running `flyctl launch`, update your `fly.toml`:

```toml
app = "triboar-rolebot"
primary_region = "sjc"  # or your preferred region

[build]
  # fly.io automatically uses the final stage (production) from Dockerfile

[env]
  PORT = "3001"
  NODE_ENV = "production"
  GRACE_PERIOD_DAYS = "7"
  GRACE_PERIOD_DM_ENABLED = "true"
  DAILY_SYNC_SCHEDULE = "59 23 * * *"
  LOG_LEVEL = "info"

[http_service]
  internal_port = 3001
  force_https = true
  auto_stop_machines = false  # Keep bot running 24/7
  auto_start_machines = false

  [[http_service.checks]]
    grace_period = "10s"
    interval = "30s"
    method = "GET"
    timeout = "5s"
    path = "/health"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
```

#### Updating Your fly.io Deployment

```bash
# Deploy latest changes
git pull
flyctl deploy

# View logs
flyctl logs

# SSH into the container
flyctl ssh console

# Check app status
flyctl status

# Scale resources if needed
flyctl scale memory 512
```

#### Setting Up Webhooks with fly.io

Your fly.io app URL will be: `https://your-app-name.fly.dev`

Update your backend to send webhooks to:
```
https://your-app-name.fly.dev/webhooks/rolebot
```

Make sure to include the `Authorization: Bearer <BACKEND_API_TOKEN>` header.

## Architecture

### Service-Oriented Design

The bot uses a modular service architecture:

- **roleService** - Manages Discord role assignments and verifications
- **dmService** - Handles all direct message notifications with rich embeds
- **backendService** - Communicates with backend API (authenticated requests)
- **syncService** - Orchestrates synchronization logic and grace period management

### Event Flows

#### New Subscription Flow
```
User Pays → Backend Webhook → POST /webhooks/rolebot
→ syncUserOnPayment() → Add @Subscribed role → Send welcome DM
```

#### Grace Period Flow
```
Subscription Expires → Backend Webhook → POST /webhooks/rolebot
→ Start grace period → Send reminder DM
↓
Daily Sync (11:59 PM) → Check grace status
→ Send daily reminders → Remove role if expired
```

#### DM Opt-Out Flow
```
User DMs "STOP" → Bot receives message
→ Update backend preference → Confirm opt-out
→ User can reply "START" to opt back in
```

## API Endpoints

### Backend API (consumed by bot)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/lists/subscribed` | Fetch all active subscribers |
| GET | `/api/lists/grace` | Fetch users in grace period |
| POST | `/api/admin/grace-period/add` | Add user to grace period |
| POST | `/api/admin/grace-period/remove` | Remove from grace period (renewed) |
| POST | `/api/admin/grace-period/expire` | Expire grace period permanently |
| GET | `/api/admin/users/search?discordId=X` | Search user by Discord ID |
| PUT | `/api/admin/users/{id}/grace-dm-preference` | Update DM preferences |
| POST | `/api/admin/audit-log` | Log bot actions |

All requests include `Authorization: Bearer ${BACKEND_API_TOKEN}` header.

### Webhook Endpoints (exposed by bot)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/webhooks/rolebot` | Receive subscription events | Yes (Bearer token) |
| GET | `/health` | Health check endpoint | No |

#### Webhook Event Types

```json
// Subscription activated
{
  "type": "subscription.activated",
  "discordId": "123456789012345678"
}

// Subscription renewed
{
  "type": "subscription.renewed",
  "discordId": "123456789012345678"
}

// Subscription cancelled (grace period starts)
{
  "type": "subscription.cancelled",
  "discordId": "123456789012345678"
}

// Grace period started
{
  "type": "grace_period.started",
  "discordId": "123456789012345678"
}
```

## Troubleshooting

### Common Issues

**Bot not responding to webhooks**
- Verify `BACKEND_API_TOKEN` matches between bot and backend
- Check webhook URL is correct and accessible
- Review logs: `docker logs triboar-rolebot` or console output in dev mode

**Role assignment failing**
- Ensure bot role is higher than `@Subscribed` role in server settings
- Verify bot has `Manage Roles` permission
- Check `DISCORD_SUBSCRIBED_ROLE_ID` is correct

**DMs not sending**
- User may have DMs disabled or bot blocked
- Check `GRACE_PERIOD_DM_ENABLED` is set to `true`
- User may have opted out (replied "STOP")

**"Missing required environment variables" error**
- Verify `.env` file exists and is in project root
- Check all required variables are set (see Configuration section)
- Ensure `BACKEND_API_TOKEN` is at least 32 characters

**Daily sync not running**
- Verify cron schedule format in `DAILY_SYNC_SCHEDULE`
- Check system timezone (sync runs at 11:59 PM server time)
- Review logs around scheduled time

### Logging

Development mode uses pretty-printed logs:
```bash
[14:23:45.123] INFO: Bot is ready! Logged in as RoleBot#1234
```

Production mode uses JSON logs for parsing:
```bash
{"level":30,"time":1699123456789,"msg":"Bot is ready!","username":"RoleBot#1234"}
```

Set `LOG_LEVEL` to `debug` or `trace` for more verbose output.

## Contributing

1. Create a feature branch
2. Make your changes (all development via Docker)
3. Run linter:
   ```bash
   npm run docker:dev:shell
   # Then inside container:
   npm run lint
   ```
4. Test thoroughly with `npm run docker:dev`
5. Submit a pull request

For non-Docker development (if you have Node.js installed):
```bash
npm run lint
```

## License

MIT

## Support

For issues or questions, please open an issue on the repository.
