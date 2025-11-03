import dotenv from 'dotenv';

dotenv.config();

export const config = {
  discord: {
    token: process.env.DISCORD_BOT_TOKEN,
    guildId: process.env.DISCORD_GUILD_ID,
    subscribedRoleId: process.env.DISCORD_SUBSCRIBED_ROLE_ID,
  },
  backend: {
    apiUrl: process.env.BACKEND_API_URL || 'http://localhost:3000',
    apiToken: process.env.BACKEND_API_TOKEN,
  },
  gracePeriod: {
    days: parseInt(process.env.GRACE_PERIOD_DAYS) || 7,
    dmEnabled: process.env.GRACE_PERIOD_DM_ENABLED !== 'false',
  },
  schedule: {
    dailySync: process.env.DAILY_SYNC_SCHEDULE || '59 23 * * *', // 11:59 PM daily
  },
};

// Validate required config
const requiredEnvVars = ['DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID', 'DISCORD_SUBSCRIBED_ROLE_ID', 'BACKEND_API_TOKEN'];
const missing = requiredEnvVars.filter(v => !process.env[v]);

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env and fill in the values');
  process.exit(1);
}

// Validate BACKEND_API_TOKEN has minimum length
if (config.backend.apiToken && config.backend.apiToken.length < 32) {
  console.error('BACKEND_API_TOKEN must be at least 32 characters long');
  process.exit(1);
}

export default config;
