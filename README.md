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

## Prerequisites

- Node.js 22.x or higher
- Discord Bot Token with required permissions
- Access to Triboar backend API
- Discord server with Guild ID and Role ID

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

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up required environment variables** (see Configuration section below)

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

### Local Development

1. **Start the backend API** (in separate terminal)
   ```bash
   cd triboar-site/backend
   npm run dev
   ```

2. **Set up ngrok for webhook testing** (in separate terminal)
   ```bash
   ngrok http 3000
   # Note the HTTPS URL provided
   ```

3. **Configure webhook URL in your backend**
   ```
   Update your backend to send webhooks to: https://your-ngrok-url.ngrok.io/webhooks/rolebot
   ```

4. **Start the bot in development mode**
   ```bash
   npm run dev
   ```

The bot will automatically reload on file changes using nodemon.

### Development Scripts

```bash
# Start bot with hot-reload
npm run dev

# Start bot (production mode)
npm start

# Run linter
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
├── Dockerfile                 # Multi-stage Docker build
├── package.json              # Dependencies and scripts
├── .env.example              # Environment variable template
└── README.md                 # This file
```

## Deployment

### Docker Deployment

1. **Build the Docker image**
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

3. **Check container health**
   ```bash
   docker ps
   curl http://localhost:3001/health
   ```

4. **View logs**
   ```bash
   docker logs -f triboar-rolebot
   ```

### Docker Compose (Recommended)

Create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  rolebot:
    build: .
    container_name: triboar-rolebot
    restart: unless-stopped
    ports:
      - "3001:3001"
    env_file:
      - .env
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 5s
```

Run with:
```bash
docker-compose up -d
```

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
2. Make your changes
3. Run linter: `npm run lint`
4. Test thoroughly
5. Submit a pull request

## License

MIT

## Support

For issues or questions, please open an issue on the repository.
