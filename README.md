# Triboar RoleBot

Discord bot for managing Triboar Guildhall subscription roles. Automatically handles role assignment, grace periods, and member lifecycle.

## Features

✅ **Automatic Role Management**
- Assigns @Subscribed role on payment
- Removes role on subscription expiration
- Handles grace period (7 days after expiration)

✅ **Grace Period System**
- Users keep @Subscribed role for 7 days after subscription ends
- Daily reminder DMs during grace period
- Users can opt-out of reminders
- Auto-remove role if not renewed after 7 days
- Re-instate if user renews during grace period

✅ **Daily Sync**
- Runs at 11:59 PM every day
- Validates all subscriptions
- Moves expired to grace period
- Removes expired grace period users
- Sends reminder DMs

✅ **Member Events**
- Welcome subscribers when they join
- Send confirmation DM on payment

✅ **Webhook Integration**
- Receives events from backend
- Immediate role sync on payment
- Real-time updates

## Setup

### 1. Create Discord Bot

1. Go to https://discord.com/developers/applications
2. Create new application
3. Go to "Bot" tab → "Add Bot"
4. Copy token to `.env` as `DISCORD_BOT_TOKEN`
5. Enable "Message Content Intent"
6. Set permissions: Manage Roles, Manage Guild

### 2. Configure Environment

```bash
cp .env.example .env
```

Fill in:
```env
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_GUILD_ID=your_guild_id
DISCORD_SUBSCRIBED_ROLE_ID=role_id
BACKEND_API_URL=http://localhost:3000
BACKEND_API_TOKEN=your_admin_jwt
```

### 3. Install & Run

```bash
npm install
npm run dev
```

Bot will:
- Connect to Discord
- Start webhook server on port 3001
- Perform initial sync
- Schedule daily 11:59 PM sync

## Architecture

```
Discord Bot (RoleBot)
├── RoleService - Add/remove roles
├── BackendService - API calls to subscription backend
├── DMService - Send reminder DMs
├── SyncService - Daily sync logic
└── Webhook Server - Receive payment events
```

## API Endpoints

### Backend Integration

Bot calls these endpoints:

```
GET  /api/admin/subscribers
     → Get all active subscribers

GET  /api/admin/grace-period
     → Get users in grace period

POST /api/admin/grace-period/add
     → Move user to grace period

POST /api/admin/grace-period/remove
     → Remove from grace period (renewed)

POST /api/admin/grace-period/expire
     → Expire grace period (not renewed)

PUT  /api/admin/users/:userId/grace-dm-preference
     → Update DM opt-in/out
```

### Incoming Webhooks

Backend sends events to:

```
POST /webhooks/rolebot

Event types:
- subscription.activated
- subscription.renewed
- subscription.cancelled
- grace_period.started
```

## Daily Sync Process (11:59 PM)

1. Get all active subscribers from backend
2. Add @Subscribed role to active subscribers
3. Get all grace period users
4. For each grace period user:
   - If still in grace period: ensure role, send reminder DM
   - If grace period expired: remove role, send notification
5. Check for members with role who shouldn't have it
6. Remove invalid roles

## Grace Period Flow

```
User Subscription Ends (June 15)
    ↓
Move to grace_period table (until June 22)
    ↓
Each day: Send reminder DM (if enabled)
    ↓
June 22 at 11:59 PM
    ├─ User renewed? → Move back to active
    └─ User didn't renew? → Remove role + notify
```

## DM System

### Reminder DM (During Grace Period)
- Shows days remaining
- Link to renew subscription
- Note about losing access

### Expiration DM (After Grace Period)
- Informs of role removal
- Offers to renew anytime
- Link to renew subscription

### Confirmation DM (On New Payment)
- Welcome message
- Shows features now available
- Link to getting started

## Configuration

### Grace Period
```env
GRACE_PERIOD_DAYS=7              # Days in grace period
GRACE_PERIOD_DM_ENABLED=true     # Send DM reminders
```

### Sync Schedule (Cron Format)
```env
DAILY_SYNC_SCHEDULE=59 23 * * *  # 11:59 PM every day
```

Common patterns:
- `59 23 * * *` → 11:59 PM daily
- `0 0 * * *` → Midnight daily
- `0 */6 * * *` → Every 6 hours
- `*/30 * * * *` → Every 30 minutes

## Commands (DMs only)

Users can reply to grace period DMs:

```
STOP   → Opt out of grace period reminders
START  → Opt back in to grace period reminders
```

## Error Handling

- Graceful Discord API errors (rate limits, member not found)
- Retry logic with exponential backoff
- Logs all actions for debugging
- Continues even if individual sync fails

## Logging

Structured logs via Pino:

```
info: User synced on payment
warn: Found member with subscribed role but no valid subscription
error: Failed to add subscribed role
```

Set log level in `.env`:
```env
LOG_LEVEL=debug  # debug, info, warn, error
```

## Webhook Testing

Test webhook locally:

```bash
curl -X POST http://localhost:3001/webhooks/rolebot \
  -H "Content-Type: application/json" \
  -d '{
    "type": "subscription.activated",
    "data": {
      "discordId": "123456789",
      "userId": "user-id"
    }
  }'
```

## Troubleshooting

### Bot doesn't add roles
- Check bot has "Manage Roles" permission
- Check bot's role is higher than @Subscribed
- Check DISCORD_GUILD_ID is correct

### DMs not sending
- Check user has DMs enabled
- Check bot can access user (privacy settings)
- Check LOG_LEVEL=debug for errors

### Webhook not processing
- Check backend is calling the webhook
- Verify PORT environment variable (default 3001)
- Check logs for webhook errors

### Grace period not working
- Check backend has `grace_period` table
- Verify BACKEND_API_TOKEN is valid
- Check backend API is responding

## Database Schema (Backend)

Bot expects these tables in backend:

### subscriptions
- `stripe_subscription_id` (string)
- `current_period_end` (timestamp)
- `status` (active, past_due, etc.)

### grace_period (needs to be created)
- `user_id` (FK)
- `discord_id` (string)
- `grace_period_ends_at` (timestamp)
- `dm_enabled` (boolean)
- `created_at` (timestamp)

## Future Enhancements

- [ ] Status channel with subscriber counts
- [ ] Admin commands for manual role management
- [ ] Webhook retry queue
- [ ] Metrics/monitoring
- [ ] Custom grace period per tier
- [ ] Multiple subscription tiers

## Support

Check logs:
```bash
npm run dev
```

Logs show all bot actions, API calls, Discord events.

For issues, provide:
1. Error message from logs
2. User ID/Discord username
3. Expected vs actual behavior
